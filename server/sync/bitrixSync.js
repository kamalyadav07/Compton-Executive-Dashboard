/**
 * server/sync/bitrixSync.js
 * -----------------------------------------------------------------------
 * Server-Side Bitrix24 CRM Sync Pipeline.
 *
 * Flow:
 *   Bitrix REST API (Rate-Limited Queue)
 *   → Normalization & Enrichment (GST, Rep, Stages)
 *   → Validation & Error Handling
 *   → PostgreSQL System of Record (deals, sales_reps, customers, etc.)
 *   → Audit Trail (sync_runs, sync_errors)
 */

const { pool } = require('../db');
const { startSyncRun, logSyncError, finishSyncRun, getLastSyncedAt, setLastSyncedAt } = require('./syncLogger');
const { validationPipeline } = require('../services/validationService');

// ── Rate Limited Request Queue ──────────────────────────────────────────

class RateLimitedQueue {
  constructor(opts = {}) {
    this.concurrency = opts.concurrency ?? 3;
    this.minIntervalMs = opts.minIntervalMs ?? 300;
    this.maxRetries = opts.maxRetries ?? 4;
    this.active = 0;
    this.lastStart = 0;
    this._waiters = [];
  }

  async run(taskFn, label = 'request') {
    while (this.active >= this.concurrency) {
      await new Promise(resolve => this._waiters.push(resolve));
    }
    const now = Date.now();
    const wait = Math.max(0, this.minIntervalMs - (now - this.lastStart));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));

    this.active++;
    this.lastStart = Date.now();
    try {
      return await this._withRetry(taskFn, label);
    } finally {
      this.active--;
      if (this._waiters.length > 0) {
        const next = this._waiters.shift();
        next();
      }
    }
  }

  async _withRetry(taskFn, label) {
    let lastErr;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await taskFn();
        if (result && typeof result === 'object' && result.error) {
          if (result.error === 'QUERY_LIMIT_EXCEEDED' || result.error === 'OPERATION_TIME_LIMIT') {
            throw new Error(`Bitrix throttled: ${result.error}`);
          }
        }
        return result;
      } catch (err) {
        lastErr = err;
        if (attempt < this.maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 10000);
          console.warn(`[BitrixQueue] Retry ${attempt + 1}/${this.maxRetries} for "${label}" in ${Math.round(backoff)}ms: ${err.message}`);
          await new Promise(r => setTimeout(r, backoff));
        }
      }
    }
    throw lastErr;
  }
}

const queue = new RateLimitedQueue({ concurrency: 3, minIntervalMs: 300, maxRetries: 4 });

// ── Financial and Entity Helpers ────────────────────────────────────────

const GST_RATE = 0.18;

function splitGst(grossRevenue, isWon) {
  const gross = Number.isFinite(grossRevenue) ? grossRevenue : 0;
  if (!isWon) return { netRevenue: gross, gstAmount: 0 };
  const netRevenue = Math.round((gross / (1 + GST_RATE)) * 100) / 100;
  const gstAmount = Math.round((gross - netRevenue) * 100) / 100;
  return { netRevenue, gstAmount };
}

const REP_ID_MAP = {
  '212': 'Sandeep Vahi',
  '196': 'Rohit Yadav',
  '226': 'Jitesh Chander',
  '230': 'Taniya Negi',
  '232': 'Alka Rawat',
  '234': 'Sunil Kumar',
  '1544': 'Akash Panwar',
  '1572': 'Akshay Gupta',
  '1612': 'Siddharth'
};

const INDIVIDUAL_REP_MONTHLY_TARGETS = {
  'Sandeep Vahi': 3950000,
  'Rohit Yadav': 7500000,
  'Jitesh Chander': 4000000,
  'Taniya Negi': 550000
};

function mapSalesRepresentative(assignedById, titleAndComments = '') {
  const cleanId = String(assignedById || '').trim();
  if (REP_ID_MAP[cleanId]) return REP_ID_MAP[cleanId];

  const text = String(titleAndComments || '').toLowerCase();
  for (const name of Object.values(REP_ID_MAP)) {
    if (text.includes(name.toLowerCase())) return name;
  }
  return 'Unassigned Rep';
}

function parseStageOrder(stageId, type) {
  if (type === 'won') return { name: 'Won', prob: 100 };
  if (type === 'lost') return { name: 'Lost', prob: 0 };

  const s = String(stageId || '').toUpperCase();
  if (s.includes('NEW')) return { name: 'Need Analysis', prob: 30 };
  if (s.includes('UC_U1DIM3') || s.includes('PREP')) return { name: 'Solution Design', prob: 45 };
  if (s.includes('PREPARATION')) return { name: 'Solution Approval', prob: 60 };
  if (s.includes('PREPAYMENT') || s.includes('INVOICE')) return { name: 'Quote Creation', prob: 70 };
  if (s.includes('EXECUTING') || s.includes('FINAL')) return { name: 'Quote Approval', prob: 80 };
  if (s.includes('UC_OQLF1D') || s.includes('NEGOTIAT') || s.includes('CONTRACT')) return { name: 'Negotiation', prob: 90 };
  if (s.includes('UC_JFWHE2') || s.includes('ORDER')) return { name: 'Sales Order Creation', prob: 95 };

  return { name: 'Need Analysis', prob: 30 };
}

function normalizeDate(rawDate) {
  if (!rawDate) {
    const today = new Date();
    return {
      date: today.toISOString().slice(0, 10),
      monthYear: today.toISOString().slice(0, 7),
      year: today.getFullYear(),
      quarter: `Q${Math.floor(today.getMonth() / 3) + 1} ${today.getFullYear()}`
    };
  }
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return normalizeDate(null);

  const year = d.getFullYear();
  const monthNum = String(d.getMonth() + 1).padStart(2, '0');
  const monthYear = `${year}-${monthNum}`;
  const quarter = `Q${Math.floor(d.getMonth() / 3) + 1} ${year}`;
  const date = d.toISOString().slice(0, 10);

  return { date, monthYear, year, quarter };
}

// ── Bitrix Multi-Page Fetcher ──────────────────────────────────────────

async function fetchAllPages(buildUrlFn, pageSize = 50) {
  const firstPage = await queue.run(() => fetch(buildUrlFn(0)).then(r => r.json()), 'page:0');
  const total = Number(firstPage?.total) || (firstPage?.result ? firstPage.result.length : 0);
  const items = [...(firstPage?.result || [])];

  if (total <= pageSize) return { items, total };

  const startOffsets = [];
  for (let s = pageSize; s < total; s += pageSize) {
    startOffsets.push(s);
  }

  const batchPromises = startOffsets.map(start =>
    queue.run(() => fetch(buildUrlFn(start)).then(r => r.json()), `page:${start}`)
      .then(json => json?.result || [])
      .catch(() => [])
  );

  const results = await Promise.all(batchPromises);
  results.forEach(pageItems => items.push(...pageItems));

  return { items, total };
}

// ── High-Speed Batch Fetcher for Comments & Product Rows ────────────────

async function fetchBitrixDetailsBatch(baseUrl, dealIds) {
  const commentsMap = {};
  const productsMap = {};
  if (!dealIds || dealIds.length === 0) return { commentsMap, productsMap };

  const BATCH_SIZE = 25;
  const chunks = [];
  for (let i = 0; i < dealIds.length; i += BATCH_SIZE) {
    chunks.push(dealIds.slice(i, i + BATCH_SIZE));
  }

  const batchPromises = chunks.map(chunk => {
    const bodyParams = new URLSearchParams();
    chunk.forEach(id => {
      bodyParams.append(`cmd[c_${id}]`, `crm.timeline.comment.list?filter[ENTITY_TYPE]=deal&filter[ENTITY_ID]=${id}`);
      bodyParams.append(`cmd[p_${id}]`, `crm.deal.productrows.get?id=${id}`);
    });

    return queue.run(() =>
      fetch(`${baseUrl}batch.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString()
      })
        .then(res => res.ok ? res.json() : null)
        .catch(() => null),
      `batchDetails-${chunk.length}-deals`
    ).catch(() => null);
  });

  const batchResultsList = await Promise.all(batchPromises);

  batchResultsList.forEach(json => {
    if (!json) return;
    const batchResults = json?.result?.result || {};
    Object.keys(batchResults).forEach(key => {
      if (key.startsWith('c_')) {
        const dealId = key.replace(/^c_/, '');
        const commentItems = batchResults[key] || [];
        if (Array.isArray(commentItems) && commentItems.length > 0) {
          commentsMap[dealId] = commentItems
            .map(item => item.COMMENT ? item.COMMENT.replace(/<[^>]*>/g, '').trim() : '')
            .filter(Boolean);
        }
      } else if (key.startsWith('p_')) {
        const dealId = key.replace(/^p_/, '');
        const prodItems = batchResults[key] || [];
        if (Array.isArray(prodItems) && prodItems.length > 0) {
          productsMap[dealId] = prodItems;
        }
      }
    });
  });

  return { commentsMap, productsMap };
}

// ── Main Bitrix Sync Execution Function ────────────────────────────────

/**
 * Execute full or incremental sync from Bitrix24 into PostgreSQL.
 * @param {Object} options - { forceFullSync: boolean }
 */
async function syncBitrixToPostgres(options = {}) {
  const syncRun = await startSyncRun('bitrix24');
  const runId = syncRun?.id;
  const startedAt = Date.now();

  const webhookUrl = process.env.BITRIX_WEBHOOK_URL || '';
  if (!webhookUrl) {
    const errorMsg = 'BITRIX_WEBHOOK_URL environment variable is not configured on server.';
    await logSyncError(runId, 'bitrix24', 'CONFIG_MISSING', errorMsg);
    await finishSyncRun(runId, 'error', { error: errorMsg, message: errorMsg });
    return { status: 'error', message: errorMsg };
  }

  const baseUrl = webhookUrl.endsWith('/') ? webhookUrl : `${webhookUrl}/`;
  const forceFull = options.forceFullSync === true;
  const lastSyncedAt = forceFull ? null : await getLastSyncedAt('bitrix24');

  console.log(`[bitrixSync] Starting ${lastSyncedAt ? `incremental sync (since ${lastSyncedAt.toISOString()})` : 'full sync'} from Bitrix24...`);

  let recordsRead = 0;
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let recordsFailed = 0;

  try {
    // 1. Build Query Parameters for Deal Fetch
    const buildUrl = (start) => {
      const qp = new URLSearchParams();
      if (lastSyncedAt && !forceFull) {
        qp.append('FILTER[>DATE_MODIFY]', lastSyncedAt.toISOString().slice(0, 19));
      } else {
        qp.append('FILTER[>DATE_CREATE]', '2019-01-01');
      }
      qp.append('SELECT[]', '*');
      qp.append('SELECT[]', 'UF_*');
      qp.append('start', String(start));
      return `${baseUrl}crm.deal.list.json?${qp.toString()}`;
    };

    // 2. Fetch Deals from Bitrix
    const { items: allFetchedDeals } = await fetchAllPages(buildUrl, 50);
    // Filter deals for Category 6 (Sales Funnel in Bitrix UI)
    const targetDeals = allFetchedDeals.filter(d => String(d.CATEGORY_ID || '0') === '6');
    recordsRead = targetDeals.length;

    console.log(`[bitrixSync] Fetched ${allFetchedDeals.length} deals total, ${targetDeals.length} in target Category 6.`);

    // 3. Fetch Timeline Comments & Products in Batches
    const targetDealIds = targetDeals.map(d => String(d.ID)).filter(Boolean);
    const { commentsMap, productsMap } = await fetchBitrixDetailsBatch(baseUrl, targetDealIds);

    // 4. Ingest Deals into PostgreSQL Transactionally through Validation Pipeline
    const salesRepMaster = await validationPipeline.getActiveSalesReps();
    const validationResultsList = [];

    for (const deal of targetDeals) {
      try {
        const bitrixDealId = `BITRIX-${deal.ID}`;
        const title = deal.TITLE || 'Untitled Deal';
        const semantic = String(deal.STAGE_SEMANTIC_ID || '').toUpperCase();
        const stageId = String(deal.STAGE_ID || '').toUpperCase();
        const isClosed = deal.CLOSED === 'Y';

        let status = 'in_progress';
        if (semantic === 'S' || stageId.includes('WON') || stageId.includes('SUCCESS')) {
          status = 'won';
        } else if (semantic === 'F' || stageId.includes('LOSE') || stageId.includes('LOST') || stageId.includes('FAIL')) {
          status = 'lost';
        }

        const rawRevenue = parseFloat(deal.OPPORTUNITY || '0') || 0;
        const isWon = status === 'won';
        const { netRevenue, gstAmount } = splitGst(rawRevenue, isWon);

        // Map Sales Rep
        const assignedUserId = String(deal.ASSIGNED_BY_ID || '');
        const salesRepName = mapSalesRepresentative(assignedUserId, `${title} ${deal.COMMENTS || ''}`);
        const monthlyTarget = INDIVIDUAL_REP_MONTHLY_TARGETS[salesRepName] || 550000.00;
        const yearlyTarget = monthlyTarget * 12;

        // Stage & Probability & Dates
        const stageInfo = parseStageOrder(stageId, status);
        const dateStr = (status === 'won' || status === 'lost')
          ? (deal.CLOSEDATE || deal.DATE_MODIFY || deal.DATE_CREATE)
          : (deal.DATE_CREATE || deal.CLOSEDATE);
        const dateInfo = normalizeDate(dateStr);

        // Customer Name & Normalization
        const customerRawName = deal.COMPANY_TITLE || deal.CONTACT_NAME || title.split(/[-–|/]/)[0].trim() || 'General Customer';
        const normalizedCustomerName = customerRawName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();

        // ── Stage 1-5 Validation Pipeline Check ────────────────────────
        const valResult = await validationPipeline.validateDeal({
          bitrixDealId,
          title,
          customerName: customerRawName,
          salesRepName,
          assignedUserId,
          stageName: stageInfo.name,
          status,
          grossRevenue: rawRevenue,
          netRevenue,
          dealDate: dateInfo.date,
          createdAt: deal.DATE_CREATE,
          closedAt: deal.CLOSEDATE,
          winProbability: stageInfo.prob
        }, salesRepMaster);

        validationResultsList.push(valResult);

        // If hard validation fails, send to DLQ (sync_errors) and skip Postgres insert
        if (!valResult.isValid) {
          recordsFailed++;
          for (const err of valResult.hardErrors) {
            await logSyncError(runId, 'bitrix24', err.rule, err.message, {
              dealId: deal.ID,
              title,
              customer: customerRawName,
              grossRevenue: rawRevenue
            });
          }
          continue;
        }

        // Upsert Sales Rep
        const repRes = await pool.query(
          `INSERT INTO sales_reps (bitrix_user_id, name, monthly_target, yearly_target)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (bitrix_user_id) DO UPDATE
           SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [assignedUserId || null, salesRepName, monthlyTarget, yearlyTarget]
        );
        const salesRepId = repRes.rows[0]?.id;

        // Upsert Customer
        const custRes = await pool.query(
          `INSERT INTO customers (name, normalized_name, industry)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING
           RETURNING id`,
          [customerRawName, normalizedCustomerName, deal.UF_CRM_67E4FF8E84730 || 'General Industry']
        );
        let customerId = custRes.rows[0]?.id;
        if (!customerId) {
          const findCust = await pool.query(`SELECT id FROM customers WHERE normalized_name = $1 LIMIT 1`, [normalizedCustomerName]);
          customerId = findCust.rows[0]?.id || null;
        }

        // Comments & Attachments
        const timelineList = commentsMap[String(deal.ID)] || [];
        const baseComment = deal.COMMENTS ? deal.COMMENTS.replace(/<[^>]*>/g, '').trim() : '';
        const allComments = Array.from(new Set([baseComment, ...timelineList].filter(Boolean))).join(' | ');
        const remarks = deal.UF_CRM_67EBCBB3098E8 || deal.SOURCE_DESCRIPTION || null;

        const attachments = [];
        Object.keys(deal).forEach(k => {
          if (k.startsWith('UF_CRM_') && deal[k] && typeof deal[k] === 'object' && deal[k].downloadUrl) {
            const fileObj = deal[k];
            attachments.push({
              id: String(fileObj.id || ''),
              showUrl: fileObj.showUrl,
              downloadUrl: fileObj.downloadUrl
            });
          }
        });

        // Upsert Deal in PostgreSQL
        const dealUpsertSql = `
          INSERT INTO deals (
            bitrix_deal_id, title, customer_id, customer_name, sales_rep_id, sales_rep_name,
            stage_id, stage_name, status, gross_revenue, net_revenue, gst_amount, margin, margin_pct,
            industry, lead_source, solution, deal_date, month_year, year, quarter,
            contract_term_months, win_probability, sales_cycle_days, lost_reason, winning_competitor,
            comments, remarks, file_attachments, raw_record, created_at, updated_at, closed_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
          ON CONFLICT (bitrix_deal_id) DO UPDATE SET
            title = EXCLUDED.title,
            customer_id = EXCLUDED.customer_id,
            customer_name = EXCLUDED.customer_name,
            sales_rep_id = EXCLUDED.sales_rep_id,
            sales_rep_name = EXCLUDED.sales_rep_name,
            stage_id = EXCLUDED.stage_id,
            stage_name = EXCLUDED.stage_name,
            status = EXCLUDED.status,
            gross_revenue = EXCLUDED.gross_revenue,
            net_revenue = EXCLUDED.net_revenue,
            gst_amount = EXCLUDED.gst_amount,
            industry = EXCLUDED.industry,
            lead_source = EXCLUDED.lead_source,
            solution = EXCLUDED.solution,
            deal_date = EXCLUDED.deal_date,
            month_year = EXCLUDED.month_year,
            year = EXCLUDED.year,
            quarter = EXCLUDED.quarter,
            win_probability = EXCLUDED.win_probability,
            sales_cycle_days = EXCLUDED.sales_cycle_days,
            lost_reason = EXCLUDED.lost_reason,
            comments = EXCLUDED.comments,
            remarks = EXCLUDED.remarks,
            file_attachments = EXCLUDED.file_attachments,
            raw_record = EXCLUDED.raw_record,
            updated_at = EXCLUDED.updated_at,
            closed_at = EXCLUDED.closed_at
          RETURNING (xmax = 0) AS is_inserted, id;
        `;

        const dealParams = [
          bitrixDealId,
          title,
          customerId,
          customerRawName,
          salesRepId,
          salesRepName,
          stageId,
          stageInfo.name,
          status,
          rawRevenue,
          netRevenue,
          gstAmount,
          Math.round(netRevenue * 0.15 * 100) / 100, // Estimated margin
          15.0, // Default 15% margin
          deal.UF_CRM_67E4FF8E84730 || 'General Industry',
          deal.SOURCE_ID || 'Direct Inquiry',
          deal.UF_CRM_1744361655612 || 'Enterprise Solutions',
          dateInfo.date,
          dateInfo.monthYear,
          dateInfo.year,
          dateInfo.quarter,
          12,
          stageInfo.prob,
          14,
          deal.UF_CRM_1742536927863 || null,
          null,
          allComments || null,
          remarks || null,
          JSON.stringify(attachments),
          JSON.stringify(deal),
          deal.DATE_CREATE || new Date().toISOString(),
          deal.DATE_MODIFY || new Date().toISOString(),
          deal.CLOSEDATE || null
        ];

        const dealResult = await pool.query(dealUpsertSql, dealParams);
        const isInserted = dealResult.rows[0]?.is_inserted;
        const dealDbId = dealResult.rows[0]?.id;

        if (isInserted) recordsInserted++;
        else recordsUpdated++;

        // Upsert Product Line Items
        const rawProducts = productsMap[String(deal.ID)] || [];
        if (rawProducts.length > 0 && dealDbId) {
          await pool.query(`DELETE FROM deal_products WHERE deal_id = $1`, [dealDbId]);
          for (const prod of rawProducts) {
            await pool.query(
              `INSERT INTO deal_products (deal_id, product_name, quantity, unit_price, total_price)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                dealDbId,
                prod.PRODUCT_NAME || 'Product',
                parseFloat(prod.QUANTITY || '1') || 1,
                parseFloat(prod.PRICE || prod.PRICE_BRUTTO || '0') || 0,
                (parseFloat(prod.QUANTITY || '1') || 1) * (parseFloat(prod.PRICE || prod.PRICE_BRUTTO || '0') || 0)
              ]
            );
          }
        }

        // Insert Deal Stage History
        if (dealDbId) {
          await pool.query(
            `INSERT INTO deal_stage_history (deal_id, stage, entered_at)
             VALUES ($1, $2, $3)`,
            [dealDbId, stageInfo.name, deal.DATE_MODIFY || deal.DATE_CREATE || new Date().toISOString()]
          );
        }
      } catch (dealErr) {
        recordsFailed++;
        await logSyncError(runId, 'bitrix24', 'RECORD_INGEST_ERROR', dealErr.message, { dealId: deal.ID });
      }
    }

    // 5. Compute 6-Dimensional Data Quality Score & Save Snapshot
    const dqiScoreObj = validationPipeline.computeQualityScore(validationResultsList, lastSyncedAt);
    await validationPipeline.recordDataQualitySnapshot(runId, 'deal', dqiScoreObj);

    // Set completion cursor timestamp
    await setLastSyncedAt('bitrix24', new Date());

    const finalStatus = recordsFailed > 0 ? (recordsInserted + recordsUpdated > 0 ? 'partial' : 'error') : 'success';
    const message = `Ingested ${recordsInserted} new deals, updated ${recordsUpdated} deals (${recordsFailed} failed) from Bitrix24. DQI Score: ${dqiScoreObj.overallScore}%`;

    await finishSyncRun(runId, finalStatus, {
      recordsRead,
      recordsInserted,
      recordsUpdated,
      recordsFailed,
      message
    });

    console.log(`[bitrixSync] ✅ ${message} (${Date.now() - startedAt}ms)`);
    return {
      status: finalStatus,
      recordsRead,
      recordsInserted,
      recordsUpdated,
      recordsFailed,
      message
    };
  } catch (syncErr) {
    console.error('[bitrixSync] 💥 Sync failed:', syncErr);
    await logSyncError(runId, 'bitrix24', 'FATAL_SYNC_ERROR', syncErr.message);
    await finishSyncRun(runId, 'error', {
      recordsRead,
      recordsInserted,
      recordsUpdated,
      recordsFailed,
      error: syncErr.message
    });
    return { status: 'error', message: syncErr.message };
  }
}

module.exports = {
  syncBitrixToPostgres
};
