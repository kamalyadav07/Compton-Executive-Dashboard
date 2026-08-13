/**
 * dashboard-server.js
 * -----------------------------------------------------------------------
 * Express backend proxy for Compton Executive Dashboard.
 *
 * PURPOSE:
 *   Move Bitrix24 webhook URL and Gemini API key out of the browser bundle
 *   (where they are extractable via devtools) to a server-side process.
 *
 * WHAT THIS FILE CONTAINS:
 *   - RateLimitedQueue + fetchAllPagesReliable  (ported from src/engine/bitrixFetchQueue.ts)
 *   - All normalization functions                (ported from src/engine/bitrixService.ts)
 *   - splitGst()                                 (ported from src/utils/financeUtils.ts)
 *   - fetchBitrixDetailsBatch                    (ported from src/engine/bitrixService.ts)
 *   - syncBitrix()  =  the full fetch + normalize pipeline
 *   - GET  /api/deals                   returns cached BitrixSyncResult
 *   - POST /api/deals/sync              triggers immediate re-sync
 *   - GET  /api/targets                 returns company sales targets
 *   - GET  /api/projection/snapshots    returns daily projection trend data
 *
 * EVERY normalization function is a 1:1 port of the original TypeScript
 * into plain CommonJS.  No business logic changes.
 * -----------------------------------------------------------------------
 */

const path = require('path');
const fs = require('fs');

try {
  require('dotenv').config();
} catch (e) {
  // Ignore missing dotenv
}

// Load root .env file if available
const parentEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(parentEnvPath)) {
  const envContent = fs.readFileSync(parentEnvPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  });
}
const express = require('express');
const cors = require('cors');

const app = express();

// ── Config ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000', 10);
const BITRIX_WEBHOOK_URL = process.env.BITRIX_WEBHOOK_URL || process.env.VITE_BITRIX_WEBHOOK_URL || '';
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '300000', 10);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// =====================================================================
// 1.  GST SPLIT  (from src/utils/financeUtils.ts — splitGst)
// =====================================================================

const GST_RATE = 0.18;

function splitGst(grossRevenue, isWon) {
  const gross = Number.isFinite(grossRevenue) ? grossRevenue : 0;
  if (!isWon) return { netRevenue: gross, gstAmount: 0 };
  const netRevenue = Math.round((gross / (1 + GST_RATE)) * 100) / 100;
  const gstAmount  = Math.round((gross - netRevenue) * 100) / 100;
  return { netRevenue, gstAmount };
}

// =====================================================================
// 2.  RATE-LIMITED QUEUE  (from src/engine/bitrixFetchQueue.ts)
// =====================================================================

class RateLimitedQueue {
  constructor(opts = {}) {
    this.concurrency   = opts.concurrency ?? 4;
    this.minIntervalMs = opts.minIntervalMs ?? 250;
    this.maxRetries    = opts.maxRetries ?? 4;
    this.active   = 0;
    this.lastStart = 0;
    this._waiters = [];
  }

  async run(taskFn, label = 'request') {
    // Wait until a slot is free
    while (this.active >= this.concurrency) {
      await new Promise(resolve => this._waiters.push(resolve));
    }
    // Enforce minimum interval between starts
    const now = Date.now();
    const wait = Math.max(0, this.minIntervalMs - (now - this.lastStart));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));

    this.active++;
    this.lastStart = Date.now();
    try {
      return await this._withRetry(taskFn, label);
    } finally {
      this.active--;
      // Wake the next waiter
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
        const backoff = Math.min(8000, 400 * Math.pow(2, attempt)) + Math.random() * 250;
        console.warn(`[bitrixFetchQueue] ${label} failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${Math.round(backoff)}ms`, err?.message || err);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
    throw new Error(`[bitrixFetchQueue] ${label} permanently failed after ${this.maxRetries + 1} attempts: ${String(lastErr)}`);
  }
}

/**
 * fetchAllPagesReliable — fetch every page of a paginated Bitrix *.list.json
 * endpoint with retry + rate limiting.
 * (ported from src/engine/bitrixFetchQueue.ts)
 */
async function fetchAllPagesReliable(buildUrl, pageSize = 50, queue = new RateLimitedQueue()) {
  const fetchWithTimeout = (url) => fetch(url, { signal: AbortSignal.timeout(15000) }).then(r => r.json());

  const first = await queue.run(() => fetchWithTimeout(buildUrl(0)), 'page:0');
  const total = first.total ?? (first.result?.length ?? 0);
  let items = first.result ?? [];
  console.log(`[fetchAllPagesReliable] First page fetched. Total records: ${total}, pages needed: ${Math.ceil(total / pageSize)}`);

  const offsets = [];
  for (let s = pageSize; s < total; s += pageSize) offsets.push(s);

  let completedPages = 1;
  const failedPages = [];
  await Promise.all(
    offsets.map(async (start) => {
      try {
        const page = await queue.run(() => fetchWithTimeout(buildUrl(start)), `page:${start}`);
        items = items.concat(page.result ?? []);
        completedPages++;
        if (completedPages % 5 === 0 || completedPages === offsets.length + 1) {
          console.log(`[fetchAllPagesReliable] Progress: ${completedPages}/${offsets.length + 1} pages fetched (${items.length} records so far)`);
        }
      } catch (err) {
        failedPages.push(start);
        console.error(`[fetchAllPagesReliable] Giving up on page start=${start}:`, err?.message || err);
      }
    })
  );

  console.log(`[fetchAllPagesReliable] ✅ Done. ${items.length} records fetched, ${failedPages.length} pages failed.`);
  return { items, total, failedPages };
}

// =====================================================================
// 3.  NORMALIZATION FUNCTIONS  (from src/engine/bitrixService.ts)
// =====================================================================

const BITRIX_INDUSTRY_ENUM_MAP = {
  '240': 'Banking and Finance',
  '248': 'Education',
  '250': 'Pharmaceutical',
  '272': 'Manufacturing',
  '280': 'Exports',
  '288': 'IT & Software',
  '296': 'Consulting',
  '304': 'Personal + self',
  '318': 'Real Estate',
  '326': 'Retail',
  '376': 'Food and Beverages',
  '420': 'Fertilizers',
  '422': 'IT',
  '424': 'Textile',
  '426': 'Iron & Steel',
  '428': 'Pulp and Paper',
  '430': 'Automobile',
  '432': 'Entertainment',
  '484': 'Embassy',
  '492': 'FMCG',
  '584': 'Electronic',
  '690': 'Hospitality',
  '1070': 'Others',
  '1072': 'Service',
  '1074': 'Infrastructure Development',
  '1088': 'Hospital',
  '1098': 'Legal',
  '1108': 'Government',
  '1174': 'Restaurants',
  '1178': 'Sports Equipment'
};

function normalizeBitrixIndustry(val, rawRecord) {
  const rawUfVal = rawRecord?.UF_CRM_67E4FF8E84730 || val;
  if (!rawUfVal) return 'General Industry';
  const str = String(rawUfVal).trim();
  if (BITRIX_INDUSTRY_ENUM_MAP[str]) return BITRIX_INDUSTRY_ENUM_MAP[str];
  const validNames = Object.values(BITRIX_INDUSTRY_ENUM_MAP);
  if (validNames.includes(str)) return str;
  return 'General Industry';
}

const BITRIX_SOLUTION_TYPE_ENUM_MAP = {
  'Data center solution': 'Data center solution',
  'Server solution': 'Server solution',
  'Storage solution': 'Storage solution',
  'Backup solution': 'Backup solution',
  'Data security solution': 'Data security solution',
  'Data back up solution': 'Data back up solution',
  'Passive Networking solution': 'Passive Networking solution',
  'CCTV Solution': 'CCTV Solution',
  'Liscense': 'Liscense',
  'Services': 'Services',
  'Desktops/ Laptops': 'Desktops/ Laptops',
  'Printers': 'Printers',
  'Power backup': 'Power backup',
  'Accessories': 'Accessories',
  'Video Conferencing': 'Video Conferencing',
  'Others': 'Others',
  'Application development': 'Application development',
  'Softwares': 'Softwares'
};

function normalizeBitrixSolutionType(val, rawRecord) {
  const rawVal = rawRecord?.UF_CRM_1744361655612 || rawRecord?.UF_CRM_SOLUTION || val;
  if (!rawVal) return 'Others';

  const str = String(rawVal).trim();
  const lower = str.toLowerCase();

  const validList = Object.values(BITRIX_SOLUTION_TYPE_ENUM_MAP);
  const exactMatch = validList.find(v => v.toLowerCase() === lower);
  if (exactMatch) return exactMatch;

  if (lower.includes('switch') || lower.includes('passive') || lower.includes('netw') || lower.includes('router') || lower.includes('cable') || lower.includes('rack')) {
    return 'Passive Networking solution';
  }
  if (lower.includes('laptop') || lower.includes('desktop') || lower.includes('pc') || lower.includes('all in one') || lower.includes('lenovo') || lower.includes('hp') || lower.includes('dell') || lower.includes('macbook')) {
    return 'Desktops/ Laptops';
  }
  if (lower.includes('cctv') || lower.includes('surveillance') || lower.includes('camera') || lower.includes('dvr') || lower.includes('nvr') || lower.includes('door')) {
    return 'CCTV Solution';
  }
  if (lower.includes('server')) {
    return 'Server solution';
  }
  if (lower.includes('storage') || lower.includes('san') || lower.includes('nas')) {
    return 'Storage solution';
  }
  if (lower.includes('backup') || lower.includes('back up') || lower.includes('veeam')) {
    return lower.includes('data') ? 'Data back up solution' : 'Backup solution';
  }
  if (lower.includes('security') || lower.includes('firewall') || lower.includes('sophos') || lower.includes('fortinet') || lower.includes('cyber')) {
    return 'Data security solution';
  }
  if (lower.includes('datacenter') || lower.includes('data center')) {
    return 'Data center solution';
  }
  if (lower.includes('license') || lower.includes('licence') || lower.includes('liscense') || lower.includes('subscription')) {
    return 'Liscense';
  }
  if (lower.includes('service') || lower.includes('amc') || lower.includes('installation') || lower.includes('support') || lower.includes('maintenance')) {
    return 'Services';
  }
  if (lower.includes('printer') || lower.includes('scanner') || lower.includes('toner')) {
    return 'Printers';
  }
  if (lower.includes('power') || lower.includes('ups') || lower.includes('battery')) {
    return 'Power backup';
  }
  if (lower.includes('accessory') || lower.includes('accessories') || lower.includes('mouse') || lower.includes('keyboard')) {
    return 'Accessories';
  }
  if (lower.includes('video') || lower.includes('conferencing') || lower.includes('polycom') || lower.includes('logitech') || lower.includes('meet')) {
    return 'Video Conferencing';
  }
  if (lower.includes('software') || lower.includes('tally') || lower.includes('os')) {
    return 'Softwares';
  }
  if (lower.includes('app') || lower.includes('development') || lower.includes('web') || lower.includes('code')) {
    return 'Application development';
  }

  return 'Others';
}

function normalizeBitrixSource(rawSource) {
  const str = String(rawSource || '').trim().toUpperCase();
  if (!str || str === '0' || str === 'NONE' || str === 'EMPTY') return 'Self Generated';

  if (str.includes('WEBFORM') || str.includes('UC_RR2BTF') || str.includes('INDIAMART') || str.includes('INDIA') || str.includes('MART')) {
    return 'India Mart';
  }
  if (str.includes('CALLBACK') || str.includes('LINKEDIN') || str.includes('LINKED')) {
    return 'LinkedIn';
  }
  if (str.includes('RC_GENERATOR') || str.includes('UC_BI5EEB') || str.includes('GOOGLE') || str.includes('ADS') || str.includes('ADWORDS')) {
    return 'Google Ads';
  }
  if (str.includes('STORE') || str.includes('EXISTING') || str.includes('CLIENT')) {
    return 'Existing Client';
  }
  if (str.includes('REPEAT_SALE') || str.includes('RECOMMENDATION') || str.includes('REFERENCE') || str.includes('REF') || str.includes('WORD')) {
    return 'Reference';
  }
  if (str.includes('BOOKING') || str.includes('EMAIL') || str.includes('E-MAIL') || str.includes('MAIL')) {
    return 'E-Mail';
  }
  if (str.includes('CALL') || str.includes('PARTNER') || str.includes('SELF') || str.includes('DIRECT') || str.includes('OTHER') || str.includes('TRADE_SHOW')) {
    return 'Self Generated';
  }
  return 'Self Generated';
}

const ALLOWED_BITRIX_REPS = [
  'Jitesh Chander',
  'Sandeep Vahi',
  'Rohit Yadav',
  'Taniya Negi',
  'Tausif Ahmad',
  'Ashok Kumar'
];

function normalizeSalesRep(rawRep, textToSearch) {
  const combined = `${rawRep || ''} ${textToSearch || ''}`.toLowerCase();
  if (combined.includes('jitesh'))  return 'Jitesh Chander';
  if (combined.includes('sandeep')) return 'Sandeep Vahi';
  if (combined.includes('rohit'))   return 'Rohit Yadav';
  if (combined.includes('taniya'))  return 'Taniya Negi';
  if (combined.includes('tausif'))  return 'Tausif Ahmad';
  if (combined.includes('ashok'))   return 'Ashok Kumar';
  return 'Jitesh Chander';
}

const BITRIX_USER_MAP = {
  '12': 'Sandeep Vahi',
  '58': 'Jitesh Chander',
  '32': 'Rohit Yadav',
  '60': 'Taniya Negi',
  '108': 'Taniya Negi',
  '216': 'Ashok Kumar',
  '222': 'Tausif Ahmad',
  '46': 'Rohit Yadav',
  '64': 'Jitesh Chander',
  '66': 'Taniya Negi',
  '76': 'Sandeep Vahi',
  '212': 'Jitesh Chander',
  '10': 'Jitesh Chander',
  '1': 'Jitesh Chander'
};

function mapBitrixAssignedUser(assignedId, textToSearch) {
  const cleanId = String(assignedId || '').trim();
  if (BITRIX_USER_MAP[cleanId]) return BITRIX_USER_MAP[cleanId];
  return normalizeSalesRep('', textToSearch);
}

function parseTitleParts(title) {
  if (!title) return { customer: 'Unknown Client', solution: 'Core Solution' };
  const parts = title.split('/').map(p => p.trim());
  if (parts.length >= 3) {
    return { customer: parts[0], solution: parts[2] };
  } else if (parts.length === 2) {
    return { customer: parts[0], solution: parts[1] };
  }
  return { customer: title.trim(), solution: 'Core Solution' };
}

function normalizeBitrixDate(dateStr) {
  let dt = null;

  if (dateStr && typeof dateStr === 'string' && dateStr.trim().length > 0) {
    const cleanStr = dateStr.trim().replace(' ', 'T');
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
      dt = parsed;
    } else {
      const mIso = cleanStr.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (mIso) {
        dt = new Date(parseInt(mIso[1], 10), parseInt(mIso[2], 10) - 1, parseInt(mIso[3], 10));
      } else {
        const mEu = cleanStr.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
        if (mEu) {
          dt = new Date(parseInt(mEu[3], 10), parseInt(mEu[2], 10) - 1, parseInt(mEu[1], 10));
        }
      }
    }
  }

  if (!dt || isNaN(dt.getTime())) {
    dt = new Date();
  }

  const year = dt.getFullYear();
  const monthIdx = dt.getMonth();
  const day = String(dt.getDate()).padStart(2, '0');
  const monthNum = String(monthIdx + 1).padStart(2, '0');

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthYear = `${monthNames[monthIdx]} ${year}`;
  const quarter = `Q${Math.floor(monthIdx / 3) + 1} ${year}`;
  const isoDate = `${year}-${monthNum}-${day}`;

  return { isoDate, monthYear, year, quarter };
}

function formatBitrixStage(type, stId) {
  if (type === 'won') return 'Won';
  if (type === 'lost') return 'Lost';

  const s = String(stId || '').toUpperCase();
  if (s.includes('NEW')) return 'Need Analysis';
  if (s.includes('UC_U1DIM3')) return 'Solution Design';
  if (s.includes('PREPARATION')) return 'Solution Approval';
  if (s.includes('PREPAYMENT')) return 'Quote Creation';
  if (s.includes('EXECUTING')) return 'Quote Approval';
  if (s.includes('UC_OQLF1D') || s.includes('NEGOTIAT') || s.includes('CONTRACT') || s.includes('CLOSING')) return 'Negotiation';

  if (s.includes('PREP')) return 'Solution Design';
  if (s.includes('INVOICE')) return 'Quote Creation';
  if (s.includes('FINAL') || s.includes('EXEC')) return 'Quote Approval';

  return 'Need Analysis';
}

// =====================================================================
// 4.  BATCH FETCH — timeline comments + product rows
//     (from src/engine/bitrixService.ts -> fetchBitrixDetailsBatch)
// =====================================================================

async function fetchBitrixDetailsBatch(baseUrl, dealIds, queue) {
  const commentsMap = {};
  const productsMap = {};
  if (!dealIds || dealIds.length === 0) return { commentsMap, productsMap };

  const BATCH_SIZE = 25;
  const chunks = [];
  for (let i = 0; i < dealIds.length; i += BATCH_SIZE) {
    chunks.push(dealIds.slice(i, i + BATCH_SIZE));
  }

  const batchPromises = chunks.map(chunk => {
    return queue.run(async () => {
      const bodyParams = new URLSearchParams();
      chunk.forEach(id => {
        bodyParams.append(`cmd[c_${id}]`, `crm.timeline.comment.list?filter[ENTITY_TYPE]=deal&filter[ENTITY_ID]=${id}`);
        bodyParams.append(`cmd[p_${id}]`, `crm.deal.productrows.get?id=${id}`);
      });

      const res = await fetch(`${baseUrl}batch.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
        signal: AbortSignal.timeout(15000)
      });
      return res.ok ? res.json() : null;
    }, `batch:${chunk[0]}..${chunk[chunk.length - 1]}`).catch(() => null);
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
          productsMap[dealId] = prodItems
            .map(item => `${item.PRODUCT_NAME || 'Product'} (Qty: ${item.QUANTITY || 1}, Price: ₹${item.PRICE || item.PRICE_BRUTTO || 0})`)
            .filter(Boolean);
        }
      }
    });
  });

  return { commentsMap, productsMap };
}

// =====================================================================
// 5.  LEAD FETCHER  (from src/engine/bitrixService.ts -> fetchBitrixLeads)
// =====================================================================

async function fetchBitrixLeads(baseUrl, minDate, queue) {
  try {
    const buildUrl = (start) => {
      const qp = new URLSearchParams();
      qp.append('FILTER[>DATE_CREATE]', minDate || '2019-01-01');
      qp.append('SELECT[]', '*');
      qp.append('SELECT[]', 'UF_*');
      qp.append('start', String(start));
      return `${baseUrl}crm.lead.list.json?${qp.toString()}`;
    };

    const { items: allRawLeads } = await fetchAllPagesReliable(buildUrl, 50, queue);

    return allRawLeads.map(lead => {
      const sem = String(lead.STATUS_SEMANTIC_ID || '').toUpperCase();
      const st = String(lead.STATUS_ID || '').toUpperCase();
      let statusType = 'in_progress';

      if (sem === 'S' || st.includes('CONVERT') || st.includes('WON')) {
        statusType = 'qualified';
      } else if (sem === 'F' || st.includes('JUNK') || st.includes('DISQUAL')) {
        statusType = 'disqualified';
      }

      return {
        id: String(lead.ID || ''),
        title: lead.TITLE || 'Untitled Lead',
        statusId: lead.STATUS_ID || 'NEW',
        statusType,
        opportunity: parseFloat(lead.OPPORTUNITY || '0') || 0,
        assignedById: String(lead.ASSIGNED_BY_ID || ''),
        salesRep: mapBitrixAssignedUser(String(lead.ASSIGNED_BY_ID || ''), `${lead.TITLE || ''} ${lead.COMMENTS || ''}`),
        dateCreate: lead.DATE_CREATE || '',
        dateModify: lead.DATE_MODIFY || '',
        dateClosed: lead.DATE_CLOSED || lead.DATE_MODIFY || lead.DATE_CREATE || '',
        sourceId: lead.SOURCE_ID || 'Direct Inquiry',
        rawRecord: lead
      };
    });
  } catch (err) {
    console.error('Error fetching Bitrix Leads:', err);
    return [];
  }
}

// =====================================================================
// 6.  FULL SYNC  (from src/engine/bitrixService.ts -> fetchBitrixDeals)
//     Produces EXACTLY the same shape as the client-side function.
// =====================================================================

const CACHE_FILE_PATH = path.resolve(__dirname, 'cached_bitrix_deals.json');

/** In-memory cache of the last successful sync result */
let cachedResult = null;
let isSyncing = false;
let activeSyncPromise = null;

if (fs.existsSync(CACHE_FILE_PATH)) {
  try {
    const rawDiskCache = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
    cachedResult = JSON.parse(rawDiskCache);
    console.log(`[startup] 📦 Loaded cached Bitrix data from disk cache (${cachedResult?.won?.length || 0} won, ${cachedResult?.lost?.length || 0} lost, ${cachedResult?.progress?.length || 0} in-progress).`);
  } catch (err) {
    console.warn('[startup] Could not parse cached_bitrix_deals.json:', err.message);
  }
}

async function syncBitrix() {
  if (isSyncing && activeSyncPromise) {
    console.log('[syncBitrix] Sync already in progress, awaiting active sync...');
    return await activeSyncPromise;
  }
  if (!BITRIX_WEBHOOK_URL) {
    console.error('[syncBitrix] BITRIX_WEBHOOK_URL not set.');
    return null;
  }

  isSyncing = true;
  activeSyncPromise = (async () => {
    const baseUrl = BITRIX_WEBHOOK_URL.endsWith('/') ? BITRIX_WEBHOOK_URL : `${BITRIX_WEBHOOK_URL}/`;
    const minDate = '2019-01-01';
    const queue = new RateLimitedQueue();

    // ── 1. Fetch all deal pages (throttled) ──────────────────────────
    const buildDealUrl = (start) => {
      const qp = new URLSearchParams();
      qp.append('FILTER[>DATE_CREATE]', minDate);
      qp.append('SELECT[]', '*');
      qp.append('SELECT[]', 'UF_*');
      qp.append('start', String(start));
      return `${baseUrl}crm.deal.list.json?${qp.toString()}`;
    };

    console.log('[syncBitrix] ⏳ Starting fetch of Bitrix deals & leads...');
    // Fetch deals and leads concurrently (but each uses the shared queue for rate limiting)
    const [dealResult, leads] = await Promise.all([
      fetchAllPagesReliable(buildDealUrl, 50, queue),
      fetchBitrixLeads(baseUrl, minDate, queue)
    ]);
    console.log(`[syncBitrix] 📥 Fetched ${dealResult.items.length} raw deals & ${leads.length} raw leads from Bitrix.`);

    const allDeals = dealResult.items;

    // ── 2. Filter for Category 6 ("Sales Funnel") ────────────────────
    const targetDeals = allDeals.filter(d => String(d.CATEGORY_ID || '0') === '6');

    // ── 3. Fetch timeline comments + products (throttled batches) ─────
    const targetDealIds = targetDeals.map(d => String(d.ID)).filter(Boolean);
    const { commentsMap: timelineCommentsMap, productsMap: dealProductsMap } =
      await fetchBitrixDetailsBatch(baseUrl, targetDealIds, queue);

    // ── 4. Normalize every deal into DealRecord shape ─────────────────
    const won = [];
    const lost = [];
    const progress = [];

    targetDeals.forEach((deal, idx) => {
      const semantic = String(deal.STAGE_SEMANTIC_ID || '').toUpperCase();
      const stageId  = String(deal.STAGE_ID || '').toUpperCase();
      const isClosed = deal.CLOSED === 'Y';

      let dealType = 'in_progress';
      if (semantic === 'S' || stageId.includes('WON') || stageId.includes('SUCCESS')) {
        dealType = 'won';
      } else if (semantic === 'F' || stageId.includes('LOSE') || stageId.includes('LOST') || stageId.includes('FAIL')) {
        dealType = 'lost';
      } else if (!isClosed || semantic === 'P') {
        dealType = 'in_progress';
      }

      const titleParts = parseTitleParts(deal.TITLE);
      const revenue = parseFloat(deal.OPPORTUNITY || '0') || 0;

      // GST split — identical to bitrixService.ts lines 565-567
      const isWonDeal = dealType === 'won';
      const { netRevenue: netRevenueWithoutGst, gstAmount: computedGstVal } = splitGst(revenue, isWonDeal);

      const salesRep = mapBitrixAssignedUser(
        String(deal.ASSIGNED_BY_ID || ''),
        `${deal.TITLE || ''} ${deal.COMMENTS || ''}`
      );

      const dateStr = (dealType === 'won' || dealType === 'lost')
        ? (deal.CLOSEDATE || deal.DATE_MODIFY || deal.DATE_CREATE)
        : (deal.DATE_CREATE || deal.CLOSEDATE);
      const dateInfo = normalizeBitrixDate(dateStr);

      // Attachments
      const attachments = [];
      Object.keys(deal).forEach(k => {
        if (k.startsWith('UF_CRM_') && deal[k] && typeof deal[k] === 'object' && deal[k].downloadUrl) {
          const fileObj = deal[k];
          const fullDownloadUrl = fileObj.downloadUrl.startsWith('http')
            ? fileObj.downloadUrl
            : `${baseUrl.replace(/\/rest\/.*$/, '')}${fileObj.downloadUrl}`;
          const fullShowUrl = fileObj.showUrl
            ? (fileObj.showUrl.startsWith('http') ? fileObj.showUrl : `${baseUrl.replace(/\/rest\/.*$/, '')}${fileObj.showUrl}`)
            : fullDownloadUrl;

          attachments.push({
            id: String(fileObj.id || ''),
            showUrl: fullShowUrl,
            downloadUrl: fullDownloadUrl
          });
        }
      });

      // Products + Remarks
      const productList = dealProductsMap[String(deal.ID)] || [];
      const baseRemarks = deal.UF_CRM_67EBCBB3098E8 || deal.SOURCE_DESCRIPTION || '';
      const allRemarksCombined = Array.from(new Set([baseRemarks, ...productList].filter(Boolean))).join(' | ');
      const remarks = allRemarksCombined || undefined;

      // Comments (timeline)
      const baseComments = deal.COMMENTS ? deal.COMMENTS.replace(/<[^>]*>/g, '').trim() : '';
      const timelineList = timelineCommentsMap[String(deal.ID)] || [];
      const allCommentsCombined = Array.from(new Set([baseComments, ...timelineList].filter(Boolean))).join(' | ');
      const comments = allCommentsCombined || undefined;

      const lostReason = deal.UF_CRM_1742536927863 || '';
      const solutionType = normalizeBitrixSolutionType(deal.UF_CRM_1744361655612 || deal.UF_CRM_SOLUTION || titleParts.solution, deal);
      const industry = normalizeBitrixIndustry(deal.UF_CRM_67E4FF8E84730 || deal.UF_CRM_CATEGORY, deal);
      const leadSource = normalizeBitrixSource(deal.SOURCE_ID);

      // Sales cycle days
      let dealSalesCycleDays = 14;
      if (deal.DATE_CREATE) {
        const createTs = new Date(deal.DATE_CREATE).getTime();
        const closeDateStr = deal.CLOSEDATE || deal.DATE_MODIFY;
        const closeTs = closeDateStr ? new Date(closeDateStr).getTime() : NaN;
        if (!isNaN(createTs) && !isNaN(closeTs) && closeTs >= createTs) {
          const diffDays = Math.round((closeTs - createTs) / (1000 * 60 * 60 * 24));
          dealSalesCycleDays = Math.max(1, diffDays);
        }
      }

      const record = {
        id: deal.ID ? `BITRIX-${deal.ID}` : `B24-${idx + 1000}`,
        customer: titleParts.customer,
        grossRevenue: revenue,
        gstAmount: parseFloat(deal.TAX_VALUE || '0') || computedGstVal,
        netRevenue: netRevenueWithoutGst,
        salesRep,
        industry,
        solution: solutionType,
        leadSource,
        stage: formatBitrixStage(dealType, stageId),
        date: dateInfo.isoDate,
        monthYear: dateInfo.monthYear,
        year: dateInfo.year,
        quarter: dateInfo.quarter,
        type: dealType,
        salesCycleDays: dealSalesCycleDays,
        lostReason: lostReason || undefined,
        remarks,
        comments,
        fileAttachments: attachments.length > 0 ? attachments : undefined,
        rawRecord: deal
      };

      if (dealType === 'won')       won.push(record);
      else if (dealType === 'lost') lost.push(record);
      else                          progress.push(record);
    });

    // ── 5. Build lead counts ──────────────────────────────────────────
    const qualifiedLeadsCount     = leads.filter(l => l.statusType === 'qualified').length;
    const disqualifiedLeadsCount  = leads.filter(l => l.statusType === 'disqualified').length;
    const inProgressLeadsCount    = leads.filter(l => l.statusType === 'in_progress').length;

    cachedResult = {
      won,
      lost,
      progress,
      leads,
      qualifiedLeadsCount,
      disqualifiedLeadsCount,
      inProgressLeadsCount,
      totalFetchedDeals: allDeals.length,
      totalFetchedLeads: leads.length,
      lastSyncedAt: new Date().toISOString(),
      status: 'success',
      message: `Loaded ${targetDeals.length} sales pipeline deals (${won.length} won, ${lost.length} lost, ${progress.length} in-progress) & ${leads.length} leads.`
    };

    if (dealResult.failedPages.length > 0) {
      cachedResult.message += ` WARNING: ${dealResult.failedPages.length} deal page(s) failed to fetch.`;
    }

    console.log(`[syncBitrix] ✅ ${cachedResult.message}`);
    try {
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cachedResult, null, 2), 'utf8');
      console.log(`[syncBitrix] 💾 Persisted sync result to disk cache at ${CACHE_FILE_PATH}`);
    } catch (fsErr) {
      console.warn('[syncBitrix] Could not save disk cache:', fsErr.message);
    }
    return cachedResult;
  })();

  try {
    return await activeSyncPromise;
  } catch (err) {
    console.error('[syncBitrix] ❌ Error:', err);
    if (!cachedResult) {
      cachedResult = {
        won: [], lost: [], progress: [], leads: [],
        qualifiedLeadsCount: 0, disqualifiedLeadsCount: 0, inProgressLeadsCount: 0,
        totalFetchedDeals: 0, totalFetchedLeads: 0,
        lastSyncedAt: new Date().toISOString(),
        status: 'error',
        message: err.message || 'Failed to fetch deals from Bitrix24 Webhook.'
      };
    }
    return cachedResult;
  } finally {
    isSyncing = false;
    activeSyncPromise = null;
  }
}

// ── Deal API Endpoints ───────────────────────────────────────────────
app.get('/api/deals', async (_req, res) => {
  if (!cachedResult) {
    if (isSyncing && activeSyncPromise) {
      console.log('[api/deals] Initial sync in progress, awaiting completion...');
      await activeSyncPromise;
    } else {
      await syncBitrix();
    }
  }

  if (!cachedResult) {
    return res.status(500).json({
      status: 'error',
      message: 'No deal data available.',
      won: [], lost: [], progress: [], leads: []
    });
  }

  res.json(cachedResult);
});

app.post('/api/deals/sync', async (_req, res) => {
  try {
    console.log('[api/deals/sync] Explicit re-sync triggered via POST');
    const result = await syncBitrix();
    if (result) {
      writeProjectionSnapshot();
      ingestDealDocuments(result);
      return res.json(result);
    }
    return res.status(500).json({ status: 'error', message: 'Sync failed to return data.' });
  } catch (err) {
    console.error('[api/deals/sync] Sync error:', err);
    return res.status(500).json({ status: 'error', message: err?.message || 'Failed to sync deals' });
  }
});

// =====================================================================
// 7.  DEAL INTELLIGENCE ENGINE & CHAT ROUTE
// =====================================================================

const { GoogleGenAI } = require('@google/genai');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

// ── LangChain streaming chat agent (replaces old stateless /api/chat) ──
const { registerChatRoutes } = require('./chatRoutes');

function detectIntents(query) {
  const q = (query || '').toLowerCase();
  
  const isCloseProbability = /close\s*prob|probability\s*for|win\s*prob|closing\s*chance|probability\s*of|win\s*probability/i.test(query);

  const isRepPerformance = /performance\s*of|stats?\s*for|how\s*is\s*.*doing|sales\s*rep|rep\s*performance/i.test(query) ||
    ALLOWED_BITRIX_REPS.some(rep => q.includes(rep.toLowerCase()) || q.includes(rep.split(' ')[0].toLowerCase()));

  const isDealsClosingBy = /deals?\s*closing\s*by|closing\s*in|closing\s*within|closing\s*soon|next\s*\d+\s*days|closing\s*by\s*\d+/i.test(query);

  const isHowToClose = /how\s*(do\s*i|to)\s*close|win\s*strategy|how\s*can\s*we\s*win|close\s*deal/i.test(query);

  return { isCloseProbability, isRepPerformance, isDealsClosingBy, isHowToClose };
}

function findDealByQuery(queryText, dealsList) {
  const q = (queryText || '').trim().toLowerCase();
  if (!q || !dealsList || !Array.isArray(dealsList)) return null;

  // 1. Extract exact numeric tokens (e.g. "4406" from "4406" or "deal 4406" or "BITRIX-4406")
  const numberMatches = q.match(/\d+/g) || [];
  for (const num of numberMatches) {
    const found = dealsList.find(r => {
      const dealId = r.deal ? r.deal.id : r.id;
      const dealNum = String(dealId || '').replace(/^BITRIX-/i, '');
      return dealNum === num; // Exact numeric match
    });
    if (found) return found;
  }

  // 2. Full ID string match (e.g. "bitrix-4406")
  const fullIdMatch = dealsList.find(r => {
    const dealId = r.deal ? r.deal.id : r.id;
    return q.includes(String(dealId || '').toLowerCase());
  });
  if (fullIdMatch) return fullIdMatch;

  // 3. Customer name match
  const customerMatch = dealsList.find(r => {
    const customer = r.deal ? r.deal.customer : r.customer;
    return customer && customer.length > 2 && q.includes(customer.toLowerCase());
  });
  if (customerMatch) return customerMatch;

  return null;
}

function daysBetween(a, b) {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (isNaN(t1) || isNaN(t2)) return 0;
  return Math.max(0, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)));
}

function computeRealAgeDays(deal) {
  const created = deal.rawRecord?.DATE_CREATE || deal.date;
  return daysBetween(created, new Date());
}

function computeRealDaysSinceUpdate(deal) {
  const modified = deal.rawRecord?.DATE_MODIFY || deal.rawRecord?.DATE_CREATE || deal.date;
  return daysBetween(modified, new Date());
}

const STAGE_ORDER = [
  'need analysis', 'solution design', 'solution approval',
  'quote creation', 'quote approval', 'negotiation'
];

function stageProgress(stage) {
  const idx = STAGE_ORDER.indexOf((stage || '').toLowerCase());
  if (idx === -1) return 0.3;
  return (idx + 1) / STAGE_ORDER.length;
}

function buildBenchmarks(allDeals) {
  const won = allDeals.filter(d => d.type === 'won');
  const lost = allDeals.filter(d => d.type === 'lost');

  const rate = (key) => {
    const wonCount = {}, lostCount = {};
    won.forEach(d => { const k = String(key(d) || '').trim().toLowerCase(); wonCount[k] = (wonCount[k] || 0) + 1; });
    lost.forEach(d => { const k = String(key(d) || '').trim().toLowerCase(); lostCount[k] = (lostCount[k] || 0) + 1; });
    const out = {};
    new Set([...Object.keys(wonCount), ...Object.keys(lostCount)]).forEach(k => {
      const w = wonCount[k] || 0, l = lostCount[k] || 0;
      out[k] = (w + l) > 0 ? w / (w + l) : 0.5;
    });
    return out;
  };

  const repAvgWonSize = {};
  const byRep = {};
  won.forEach(d => {
    const k = String(d.salesRep || '').trim().toLowerCase();
    (byRep[k] = byRep[k] || []).push(d);
  });
  Object.entries(byRep).forEach(([k, deals]) => {
    repAvgWonSize[k] = deals.reduce((s, d) => s + (d.grossRevenue || 0), 0) / deals.length;
  });

  return {
    repWinRates: rate(d => d.salesRep),
    industryWinRates: rate(d => d.industry),
    sourceWinRates: rate(d => d.leadSource),
    repAvgWonSize
  };
}

function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

function trainWinProbabilityModel(closedDeals, benchmarks) {
  const labeled = closedDeals
    .filter(d => d.type === 'won' || d.type === 'lost')
    .map(d => {
      const repKey = String(d.salesRep || '').trim().toLowerCase();
      const indKey = String(d.industry || '').trim().toLowerCase();
      const srcKey = String(d.leadSource || '').trim().toLowerCase();
      const repAvgSize = benchmarks.repAvgWonSize[repKey] || 350000;
      const x = [
        benchmarks.repWinRates[repKey] ?? 0.5,
        benchmarks.industryWinRates[indKey] ?? 0.5,
        benchmarks.sourceWinRates[srcKey] ?? 0.5,
        Math.min(3, (d.grossRevenue || 0) / repAvgSize),
        computeRealAgeDays(d),
        stageProgress(d.stage),
        d.comments && String(d.comments).trim().length > 0 ? 1 : 0
      ];
      return { x, y: d.type === 'won' ? 1 : 0 };
    });

  if (labeled.length < 10) {
    return { weights: [0,0,0,0,0,0,0], bias: 0, means: [0,0,0,0,0,0,0], stds: [1,1,1,1,1,1,1], trainedOn: labeled.length };
  }

  const n = labeled.length;
  const dims = 7;
  const means = new Array(dims).fill(0);
  const stds = new Array(dims).fill(1);
  for (let d = 0; d < dims; d++) means[d] = labeled.reduce((s, v) => s + v.x[d], 0) / n;
  for (let d = 0; d < dims; d++) {
    const v = labeled.reduce((s, item) => s + (item.x[d] - means[d]) ** 2, 0) / n;
    stds[d] = Math.sqrt(v) || 1;
  }
  const normed = labeled.map(l => ({
    normedX: l.x.map((val, d) => (val - means[d]) / stds[d]),
    y: l.y
  }));

  let weights = new Array(dims).fill(0);
  let bias = 0;
  for (let epoch = 0; epoch < 400; epoch++) {
    const gradW = new Array(dims).fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      const z = normed[i].normedX.reduce((s, val, d) => s + val * weights[d], bias);
      const pred = sigmoid(z);
      const err = pred - normed[i].y;
      for (let d = 0; d < dims; d++) gradW[d] += err * normed[i].normedX[d];
      gradB += err;
    }
    for (let d = 0; d < dims; d++) weights[d] -= 0.3 * (gradW[d] / n + 0.01 * weights[d]);
    bias -= 0.3 * (gradB / n);
  }

  return { weights, bias, means, stds, trainedOn: n };
}

function scoreDeal(deal, model, benchmarks) {
  const repKey = String(deal.salesRep || '').trim().toLowerCase();
  const indKey = String(deal.industry || '').trim().toLowerCase();
  const srcKey = String(deal.leadSource || '').trim().toLowerCase();
  const repAvgSize = benchmarks.repAvgWonSize[repKey] || 350000;
  const raw = [
    benchmarks.repWinRates[repKey] ?? 0.5,
    benchmarks.industryWinRates[indKey] ?? 0.5,
    benchmarks.sourceWinRates[srcKey] ?? 0.5,
    Math.min(3, (deal.grossRevenue || 0) / repAvgSize),
    computeRealAgeDays(deal),
    stageProgress(deal.stage),
    deal.comments && String(deal.comments).trim().length > 0 ? 1 : 0
  ];
  const normed = raw.map((v, d) => (v - model.means[d]) / model.stds[d]);
  const z = normed.reduce((s, v, d) => s + v * model.weights[d], model.bias);
  return Math.round(Math.max(1, Math.min(99, sigmoid(z) * 100)));
}

function buildCycleDistribution(wonDeals) {
  const byStage = {};
  wonDeals.forEach(d => {
    const key = (d.stage || 'unknown').toLowerCase();
    byStage[key] = byStage[key] || [];
    if (d.salesCycleDays && d.salesCycleDays > 0) byStage[key].push(d.salesCycleDays);
  });
  byStage['__all__'] = wonDeals.map(d => d.salesCycleDays || 30).filter(v => v > 0);
  return byStage;
}

function probabilityCloseWithinDays(deal, distribution, horizonDays) {
  const stageKey = (deal.stage || 'unknown').toLowerCase();
  let sample = distribution[stageKey];
  if (!sample || sample.length < 5) sample = distribution['__all__'] || [];
  const ageDays = computeRealAgeDays(deal);
  const stillAlive = sample.filter(c => c >= ageDays);
  const sampleSize = stillAlive.length;

  let probabilityPct = 35;
  if (sampleSize >= 5) {
    const closesInWindow = stillAlive.filter(c => c <= ageDays + horizonDays).length;
    probabilityPct = Math.round((closesInWindow / sampleSize) * 100);
  }
  const medianRem = sampleSize > 0
    ? (() => {
        const sorted = stillAlive.map(c => Math.max(0, c - ageDays)).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      })()
    : 14;
  const expDate = new Date();
  expDate.setDate(expDate.getDate() + Math.round(medianRem));
  return {
    probabilityPct,
    sampleSize,
    expectedCloseDate: expDate.toISOString().slice(0, 10)
  };
}

function runDealIntelligenceServer(allDeals) {
  const benchmarks = buildBenchmarks(allDeals);
  const closedDeals = allDeals.filter(d => d.type === 'won' || d.type === 'lost');
  const model = trainWinProbabilityModel(closedDeals, benchmarks);
  const distribution = buildCycleDistribution(allDeals.filter(d => d.type === 'won'));

  const openDeals = allDeals.filter(d => d.type === 'in_progress');
  const results = openDeals.map(deal => {
    const winProbabilityPct = scoreDeal(deal, model, benchmarks);
    const p7 = probabilityCloseWithinDays(deal, distribution, 7);
    const p15 = probabilityCloseWithinDays(deal, distribution, 15);
    return {
      deal,
      winProbabilityPct,
      closesWithin7DaysPct: p7.probabilityPct,
      closesWithin15DaysPct: p15.probabilityPct,
      expectedCloseDate: p15.expectedCloseDate,
      ageDays: computeRealAgeDays(deal),
      daysSinceLastUpdate: computeRealDaysSinceUpdate(deal),
      confidenceNote: p15.sampleSize < 5
        ? `Low historical sample (${p15.sampleSize} comparable won deals)`
        : `Based on ${p15.sampleSize} comparable historical won deals.`
    };
  });

  return { results, model, benchmarks };
}

function buildGroundedActionPlan(deal, allDeals, benchmarks) {
  const custName = String(deal.customer || '').trim().toLowerCase();
  const cWon = allDeals.filter(d => d.type === 'won' && String(d.customer || '').trim().toLowerCase() === custName);
  const cLost = allDeals.filter(d => d.type === 'lost' && String(d.customer || '').trim().toLowerCase() === custName);
  const repKey = String(deal.salesRep || '').trim().toLowerCase();
  const repWinRate = Math.round((benchmarks.repWinRates[repKey] || 0.5) * 100);
  const repAvgDealSize = benchmarks.repAvgWonSize[repKey] || 350000;
  const ageDays = computeRealAgeDays(deal);
  const daysSinceUpdate = computeRealDaysSinceUpdate(deal);

  const strengths = [];
  const risks = [];
  const recommendedActions = [];

  if (cWon.length > 0) {
    const totalRev = cWon.reduce((s, r) => s + (r.netRevenue || 0), 0);
    strengths.push(`Existing customer with ${cWon.length} previous won deal(s) totaling ₹${totalRev.toLocaleString('en-IN')}`);
  } else {
    strengths.push('High-potential customer opportunity');
  }

  if (repWinRate >= 55) {
    strengths.push(`Sales rep ${deal.salesRep} has a strong ${repWinRate}% win rate`);
  }

  if (deal.comments && deal.comments.length > 0) {
    strengths.push(`Recorded CRM timeline notes: "${deal.comments.slice(0, 100)}"`);
  }

  if (deal.grossRevenue > repAvgDealSize * 1.25) {
    risks.push(`Deal size (₹${deal.grossRevenue.toLocaleString('en-IN')}) is larger than rep's average won deal size (₹${Math.round(repAvgDealSize).toLocaleString('en-IN')})`);
  }

  if (ageDays > 14) {
    risks.push(`Deal has been in pipeline for ${ageDays} days (real age derived from Bitrix creation date)`);
  }

  if (daysSinceUpdate > 7) {
    risks.push(`No activity logged for ${daysSinceUpdate} days (derived from Bitrix modification timestamp)`);
  }

  if (cLost.length > 0) {
    risks.push(`Customer has ${cLost.length} previously lost deal(s) on record`);
  }

  recommendedActions.push(`Schedule direct executive check-in for stage '${deal.stage}'`);
  if (deal.solution) {
    recommendedActions.push(`Highlight Compton's proven ${deal.solution} deployment track record in ${deal.industry}`);
  }
  recommendedActions.push('Review quoted proposal items and confirm timeline commitments');

  return { strengths, risks, recommendedActions };
}

// ── EXPRESS ROUTES ──

app.get('/api/deals', async (_req, res) => {
  if (!cachedResult && isSyncing && activeSyncPromise) {
    console.log('[api/deals] Initial Bitrix sync in progress, awaiting sync completion...');
    await activeSyncPromise.catch(() => null);
  }

  if (!cachedResult) {
    return res.status(503).json({
      status: 'error',
      message: 'Server is still performing initial Bitrix sync. Please retry in a few seconds.'
    });
  }
  res.json(cachedResult);
});

app.post('/api/deals/sync', async (_req, res) => {
  try {
    const result = await syncBitrix();
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── Register LangChain streaming chat routes ─────────────────────────
// The cache wrapper gives chatRoutes/langchainAgent access to the same
// cachedResult object dashboard-server.js already maintains via syncBitrix().
// No second cache — single source of truth.
const chatCache = {
  get won()      { return cachedResult?.won || []; },
  get lost()     { return cachedResult?.lost || []; },
  get progress() { return cachedResult?.progress || []; },
};
registerChatRoutes(app, chatCache);

// Legacy /api/chat endpoint — kept as a compatibility redirect.
// AIChatbotDrawer now uses /api/chat/stream (streaming) instead.
app.post('/api/chat', (_req, res) => {
  res.status(410).json({
    status: 'moved',
    message: 'This endpoint has been replaced by POST /api/chat/stream (streaming SSE). Update your client.'
  });
});

function formatExecutiveFallbackResponse(query, intents, intelligence, allDeals, structuredContext) {
  let text = '';

  // 1. Specific Deal Query Check (Always check if user asked about a specific deal ID like "4406", "BITRIX-4406")
  const specificDeal = findDealByQuery(query, allDeals);
  if (specificDeal) {
    const dealObj = specificDeal.deal || specificDeal;
    const intelResult = intelligence.results.find(r => r.deal.id === dealObj.id);
    const plan = buildGroundedActionPlan(dealObj, allDeals, intelligence.benchmarks);

    text += `### ⚡ 📊 DEAL OVERVIEW: ${dealObj.customer.toUpperCase()} (${dealObj.id})\n\n`;
    text += `* **Deal ID:** \`${dealObj.id}\`\n`;
    text += `* **Customer Name:** **${dealObj.customer}**\n`;
    text += `* **Sales Representative:** ${dealObj.salesRep}\n`;
    text += `* **Net Revenue:** **₹${(dealObj.netRevenue || 0).toLocaleString('en-IN')}**\n`;
    text += `* **Gross Revenue:** ₹${(dealObj.grossRevenue || 0).toLocaleString('en-IN')}\n`;
    text += `* **Pipeline Stage:** **${dealObj.stage}** (${dealObj.type || 'in_progress'})\n\n`;

    if (intelResult) {
      text += `### ⚡ 🎯 WIN PROBABILITY & CLOSING FORECAST\n\n`;
      text += `* **Trained Model Win Probability:** **${intelResult.winProbabilityPct}%**\n`;
      text += `* **Probability Closing ≤7 Days:** **${intelResult.closesWithin7DaysPct}%**\n`;
      text += `* **Probability Closing ≤15 Days:** **${intelResult.closesWithin15DaysPct}%**\n`;
      text += `* **Expected Close Date:** \`${intelResult.expectedCloseDate}\`\n`;
      text += `* **Real Age in Pipeline:** ${intelResult.ageDays} days\n`;
      text += `* **Days Since Last Touch:** ${intelResult.daysSinceLastUpdate} days\n\n`;
    }

    if (dealObj.type === 'lost') {
      text += `### ⚡ ❌ DEAL STATUS & LOST REASON\n\n`;
      text += `* **Deal Status:** ❌ Lost (Closed)\n`;
      text += `* **Reason for Loss:** "${dealObj.lostReason || 'Not specified'}"\n\n`;
    }

    if (dealObj.comments) {
      text += `### ⚡ 💬 RECORDED COMMENTS & CUSTOMER TIMELINE NOTES\n\n`;
      text += `* 📌 "${dealObj.comments}"\n\n`;
    }

    if (dealObj.remarks || dealObj.solution) {
      text += `### ⚡ 📦 QUOTED PRODUCTS & SOLUTION SPEC\n\n`;
      text += `* **Quoted Solution / Spec:** ${dealObj.solution || 'N/A'}\n`;
      if (dealObj.remarks) {
        text += `* **Products & Line Items:** ${dealObj.remarks}\n`;
      }
      text += `\n`;
    }

    if (plan.strengths && plan.strengths.length > 0) {
      text += `### 💪 Grounded Deal Strengths\n`;
      plan.strengths.forEach(s => { text += `* 📌 ${s}\n`; });
      text += `\n`;
    }

    if (plan.risks && plan.risks.length > 0) {
      text += `### ⚠️ Grounded Risk Factors\n`;
      plan.risks.forEach(r => { text += `* ⚠️ ${r}\n`; });
      text += `\n`;
    }

    if (plan.recommendedActions && plan.recommendedActions.length > 0) {
      text += `### 🚀 Recommended Closing Actions\n`;
      plan.recommendedActions.forEach((a, i) => { text += `${i + 1}. ${a}\n`; });
      text += `\n`;
    }

    return text;
  }

  if (intents.isCloseProbability) {
    const match = intelligence.results[0];

    if (match) {
      text += `### 📊 Deal Close Probability: ${match.deal.customer} (${match.deal.id})\n\n`;
      text += `* **Deal ID:** \`${match.deal.id}\`
* **Customer Name:** **${match.deal.customer}**
* **Sales Representative:** ${match.deal.salesRep}
* **Current Pipeline Stage:** ${match.deal.stage}
* **Net Revenue (Excl. 18% GST):** **₹${match.deal.netRevenue.toLocaleString('en-IN')}**
* **Gross Revenue:** ₹${match.deal.grossRevenue.toLocaleString('en-IN')}\n\n`;
      text += `### 🎯 Trained Model Win Probability & Closing Forecast\n\n`;
      text += `* **Overall Win Probability:** **${match.winProbabilityPct}%**
* **Probability Closing Within 7 Days:** **${match.closesWithin7DaysPct}%**
* **Probability Closing Within 15 Days:** **${match.closesWithin15DaysPct}%**
* **Expected Close Date:** \`${match.expectedCloseDate}\`
* **Real Age in Pipeline:** ${match.ageDays} days
* **Days Since Last Touch:** ${match.daysSinceLastUpdate} days
* **Confidence Assessment:** ${match.confidenceNote}\n`;
      return text;
    }
  }

  if (intents.isRepPerformance) {
    const matchedRep = ALLOWED_BITRIX_REPS.find(r => 
      query.toLowerCase().includes(r.toLowerCase()) || 
      query.toLowerCase().includes(r.split(' ')[0].toLowerCase())
    ) || 'Sandeep Vahi';

    const won = allDeals.filter(d => d.type === 'won' && d.salesRep.toLowerCase() === matchedRep.toLowerCase());
    const lost = allDeals.filter(d => d.type === 'lost' && d.salesRep.toLowerCase() === matchedRep.toLowerCase());
    const prog = allDeals.filter(d => d.type === 'in_progress' && d.salesRep.toLowerCase() === matchedRep.toLowerCase());

    const totalClosed = won.length + lost.length;
    const winRatePct = totalClosed > 0 ? Math.round((won.length / totalClosed) * 100) : 0;
    const wonNetRev = won.reduce((s, d) => s + (d.netRevenue || 0), 0);
    const wonGrossRev = won.reduce((s, d) => s + (d.grossRevenue || 0), 0);
    const progNetRev = prog.reduce((s, d) => s + (d.netRevenue || 0), 0);
    const avgWonSize = won.length > 0 ? Math.round(wonNetRev / won.length) : 0;
    const avgCycleDays = won.length > 0 ? Math.round(won.reduce((s, d) => s + (d.salesCycleDays || 14), 0) / won.length) : 14;

    text += `### 👤 Performance Overview: ${matchedRep}\n\n`;
    text += `* **Sales Representative:** **${matchedRep}**
* **Historical Win Rate:** **${winRatePct}%** (${won.length} Won / ${lost.length} Lost)
* **Total Won Net Revenue:** **₹${wonNetRev.toLocaleString('en-IN')}**
* **Total Won Gross Revenue:** ₹${wonGrossRev.toLocaleString('en-IN')}
* **Active In-Progress Deals:** ${prog.length} deals (₹${progNetRev.toLocaleString('en-IN')} Net Pipeline)
* **Average Won Deal Size:** ₹${avgWonSize.toLocaleString('en-IN')}
* **Average Sales Cycle Length:** ${avgCycleDays} days\n`;
    return text;
  }

  if (intents.isDealsClosingBy) {
    const targetDate15 = new Date();
    targetDate15.setDate(targetDate15.getDate() + 15);
    const formatted15Date = targetDate15.toISOString().slice(0, 10);

    const sortedByClose = [...intelligence.results]
      .sort((a, b) => b.closesWithin15DaysPct - a.closesWithin15DaysPct)
      .slice(0, 10);

    text += `### 📅 Deals Forecasted to Close Soon (Next 15 Days — by ${formatted15Date})\n\n`;
    text += `Here are the top in-progress deals ranked by their 15-day close probability:\n\n`;
    text += `| Customer Name | Sales Rep | Stage | Net Revenue | Win Prob (%) | Closes ≤7d (%) | Closes ≤15d (%) | Expected Close |\n`;
    text += `|---|---|---|---|---|---|---|---|\n`;
    sortedByClose.forEach(r => {
      text += `| **${r.deal.customer}** | ${r.deal.salesRep} | ${r.deal.stage} | ₹${(r.deal.netRevenue || 0).toLocaleString('en-IN')} | **${r.winProbabilityPct}%** | ${r.closesWithin7DaysPct}% | **${r.closesWithin15DaysPct}%** | \`${r.expectedCloseDate}\` |\n`;
    });
    return text;
  }

  if (intents.isHowToClose) {
    const match = intelligence.results[0];

    if (match) {
      const plan = buildGroundedActionPlan(match.deal, allDeals, intelligence.benchmarks);
      text += `### 🎯 Deal Closing Strategy & Action Plan: ${match.deal.customer} (${match.deal.id})\n\n`;
      text += `* **Deal ID:** \`${match.deal.id}\`
* **Customer Name:** **${match.deal.customer}**
* **Sales Representative:** ${match.deal.salesRep}
* **Current Stage:** ${match.deal.stage}
* **Net Revenue:** **₹${match.deal.netRevenue.toLocaleString('en-IN')}**
* **Win Probability:** **${match.winProbabilityPct}%**
* **Real Pipeline Age:** ${match.ageDays} days\n\n`;

      text += `### 💪 Grounded Deal Strengths\n`;
      plan.strengths.forEach(s => { text += `* 📌 ${s}\n`; });

      text += `\n### ⚠️ Grounded Risk Factors\n`;
      plan.risks.forEach(r => { text += `* ⚠️ ${r}\n`; });

      text += `\n### 🚀 Recommended Action Steps\n`;
      plan.recommendedActions.forEach((a, i) => { text += `${i + 1}. **${a}**\n`; });

      return text;
    }
  }

  // Default Fallback
  text += `### 📊 Compton Sales Intelligence Summary\n\n`;
  text += `${structuredContext || 'Processing deal data and sales metrics.'}`;
  return text;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasCachedData: !!cachedResult,
    lastSyncedAt: cachedResult?.lastSyncedAt || null,
    uptime: process.uptime()
  });
});

// ── Sales Targets ────────────────────────────────────────────────────
// Single source of truth for company targets. Both the AI agent tools
// (server-side) and the Deal Forecast dashboard (client-side) read from here.
app.get('/api/targets', (_req, res) => {
  const { getTargets, INDIVIDUAL_REP_MONTHLY_TARGETS } = require('./salesTargets');
  res.json({ ...getTargets(), repTargets: INDIVIDUAL_REP_MONTHLY_TARGETS });
});

// ── Projection Snapshots ─────────────────────────────────────────────
// Stores one row per calendar date: { date, monthProjection, fyProjection }.
// Written by writeProjectionSnapshot() after every background sync.
// Frontend reads this for the trend indicator on the Deal Forecast dashboard.
const SNAPSHOTS_FILE = path.join(__dirname, 'projectionSnapshots.json');

function readSnapshots() {
  try {
    if (!fs.existsSync(SNAPSHOTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf8'));
  } catch (_) {
    return [];
  }
}

function writeProjectionSnapshot() {
  try {
    let computeSalesProjection;
    try { ({ computeSalesProjection } = require('./engines/salesProjectionEngine')); } catch (_) { return; }
    if (!cachedResult) return;
    const { getTargets } = require('./salesTargets');
    const targets = getTargets();
    const allDeals = [...(cachedResult.won || []), ...(cachedResult.lost || []), ...(cachedResult.progress || [])];
    const monthProjection = computeSalesProjection(allDeals, 'month', targets).totalProjection;
    const fyProjection    = computeSalesProjection(allDeals, 'fy',    targets).totalProjection;
    const today = new Date().toISOString().slice(0, 10);
    const snapshots = readSnapshots().filter(s => s.date !== today);
    snapshots.push({ date: today, monthProjection, fyProjection });
    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(snapshots.slice(-30), null, 2), 'utf8');

    // Trigger Phase 21 prediction logging and outcome reconciliation
    try {
      const { recordPredictionSnapshots, reconcileClosedDeals } = require('./calibrationEngine');
      recordPredictionSnapshots(allDeals);
      reconcileClosedDeals(allDeals);
    } catch (cErr) {
      console.warn('[calibration] Error during calibration logging:', cErr.message);
    }
  } catch (err) {
    console.warn('[snapshot] Failed to write projection snapshot:', err.message);
  }
}

app.get('/api/projection/snapshots', (_req, res) => {
  res.json(readSnapshots());
});

// ── Forecast Calibration & Chat Analytics API Endpoints ───────────────

app.get('/api/forecast/calibration', (_req, res) => {
  const { computeCalibrationReport } = require('./calibrationEngine');
  const allDeals = cachedResult ? [...(cachedResult.won || []), ...(cachedResult.lost || []), ...(cachedResult.progress || [])] : [];
  res.json(computeCalibrationReport(allDeals));
});

app.get('/api/chat/analytics', (_req, res) => {
  const { getChatAnalyticsReport } = require('./chatQueryLogger');
  res.json(getChatAnalyticsReport());
});

// ── Document Ingestion ───────────────────────────────────────────────
// Ingests file attachments for deals using documentStore.js
async function ingestDealDocuments(data) {
  if (!data) return;
  const { indexDocument, extractTextFromBuffer, processedFileIds } = require('./documentStore');
  const allDeals = [...(data.won || []), ...(data.lost || []), ...(data.progress || [])];
  const dealsWithFiles = allDeals.filter(d => d.fileAttachments && d.fileAttachments.length > 0);
  if (dealsWithFiles.length === 0) return;

  const queue = new RateLimitedQueue(3, 100);
  let newChunks = 0;
  const promises = [];

  for (const deal of dealsWithFiles) {
    for (const file of deal.fileAttachments) {
      if (!file.id || processedFileIds.has(String(file.id))) continue;

      const p = queue.run(async () => {
        try {
          const res = await fetch(file.downloadUrl);
          if (!res.ok) {
            processedFileIds.add(String(file.id));
            return;
          }

          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            processedFileIds.add(String(file.id));
            return;
          }

          const buf = Buffer.from(await res.arrayBuffer());
          const fileName = file.fileName || `Attachment_${file.id}`;
          const extractedText = await extractTextFromBuffer(fileName, buf);

          if (extractedText && extractedText.length > 20) {
            const added = await indexDocument({
              dealId: deal.id,
              fileId: file.id,
              fileName,
              text: extractedText
            });
            newChunks += added;
            console.log(`[docIngestion] Indexed ${fileName} for ${deal.id} (${added} chunks)`);
          } else {
            processedFileIds.add(String(file.id));
          }
        } catch (err) {
          processedFileIds.add(String(file.id));
        }
      }, `ingestFile-${file.id}`);
      promises.push(p);
    }
  }

  await Promise.allSettled(promises);
  if (newChunks > 0) {
    console.log(`[docIngestion] Ingestion complete. Total new chunks added: ${newChunks}`);
  }
}

// =====================================================================
// 8.  START
// =====================================================================

app.listen(PORT, () => {
  console.log(`\n🚀 Compton Dashboard Server listening on http://localhost:${PORT}`);
  console.log(`   CORS: all origins allowed`);
  console.log(`   Sync interval: ${SYNC_INTERVAL_MS / 1000}s\n`);

  // Initial sync on startup
  syncBitrix().then((res) => {
    console.log('[startup] Initial sync complete.');
    writeProjectionSnapshot();
    ingestDealDocuments(res);
  });

  // Periodic background sync + daily projection snapshot
  setInterval(() => {
    console.log('[cron] Starting periodic Bitrix sync...');
    syncBitrix().then((res) => {
      writeProjectionSnapshot();
      ingestDealDocuments(res);
    }).catch(() => {});
  }, SYNC_INTERVAL_MS);
});
