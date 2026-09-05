/**
 * server/sync/sheetsSync.js
 * -----------------------------------------------------------------------
 * Server-Side Google Sheets Sync Pipeline for Projects & Orders.
 *
 * Flow:
 *   Google Sheets CSV Export URL
 *   → Robust Multi-Line CSV Stream Parser
 *   → Validation & Variance Math (Planned vs Actual Cost, Timeline Delay)
 *   → PostgreSQL Upserts (projects, project_tasks, customers)
 *   → Audit Trail (sync_runs, sync_errors)
 */

const { pool } = require('../db');
const { startSyncRun, logSyncError, finishSyncRun, setLastSyncedAt } = require('./syncLogger');
const { validationPipeline } = require('../services/validationService');

// ── Google Sheet URL Helper ─────────────────────────────────────────────

function convertToCsvExportUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.includes('/export?format=csv') || trimmed.includes('/pub?output=csv')) {
    return trimmed;
  }
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return trimmed;
  const docId = match[1];

  let gid = '0';
  const gidMatch = trimmed.match(/gid=([0-9]+)/);
  if (gidMatch) {
    gid = gidMatch[1];
  }
  return `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;
}

// ── Robust CSV Row Parser ───────────────────────────────────────────────

function parseCsvToObjects(csvText) {
  if (!csvText) return [];
  const lines = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(cell.trim());
      if (row.some(c => c.length > 0)) {
        lines.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c.length > 0)) lines.push(row);
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows = [];

  for (let r = 1; r < lines.length; r++) {
    const currentLine = lines[r];
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = currentLine[c] || '';
    }
    rows.push(obj);
  }

  return rows;
}

function parseCurrency(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).replace(/[^0-9.-]+/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function parseDateString(str) {
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// ── Main Google Sheets Sync Worker ─────────────────────────────────────

async function syncProjectsSheetToPostgres() {
  const syncRun = await startSyncRun('google_sheets_projects');
  const runId = syncRun?.id;
  const startedAt = Date.now();

  const sheetUrl = process.env.PROJECTS_SHEET_URL || process.env.VITE_PROJECTS_SHEET_URL || '';
  if (!sheetUrl) {
    const errorMsg = 'PROJECTS_SHEET_URL environment variable is not configured.';
    await logSyncError(runId, 'google_sheets_projects', 'CONFIG_MISSING', errorMsg);
    await finishSyncRun(runId, 'error', { error: errorMsg, message: errorMsg });
    return { status: 'error', message: errorMsg };
  }

  const csvUrl = convertToCsvExportUrl(sheetUrl);
  console.log(`[sheetsSync] Fetching Project Delivery CSV from Google Sheets...`);

  let recordsRead = 0;
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let recordsFailed = 0;

  try {
    const response = await fetch(csvUrl, {
      headers: { 'User-Agent': 'Compton-Dashboard-Sync/2.0' }
    });

    if (!response.ok) {
      throw new Error(`Google Sheets responded with HTTP ${response.status}: ${response.statusText}`);
    }

    const csvText = await response.text();
    const rawRows = parseCsvToObjects(csvText);
    recordsRead = rawRows.length;

    console.log(`[sheetsSync] Parsed ${rawRows.length} project rows from Google Sheets.`);

    for (let idx = 0; idx < rawRows.length; idx++) {
      const row = rawRows[idx];
      try {
        const sNo = row.sno || row.no || String(idx + 1);
        const customerName = row.customername || row.customer || row.client || 'General Client';
        const projectName = row.projectname || row.project || row.name || 'Unnamed Project';
        const externalProjectId = `proj-${sNo}-${customerName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)}`;

        const statusRaw = (row.status || 'Running').trim();
        let status = 'Running';
        if (/complete/i.test(statusRaw)) status = 'Completed';
        else if (/delay/i.test(statusRaw)) status = 'Delayed';
        else if (/hold/i.test(statusRaw)) status = 'On Hold';
        else if (/plan/i.test(statusRaw)) status = 'Planning';

        const projectType = row.projecttype || row.type || 'General';
        const startDate = parseDateString(row.startdate || row.start);
        const plannedEndDate = parseDateString(row.plannedenddate || row.plannedend || row.targetdate);
        const actualEndDate = parseDateString(row.actualenddate || row.actualend || row.enddate);

        const plannedBudget = parseCurrency(row.plannedbudget || row.budget || row.estimatedcost);
        const actualCost = parseCurrency(row.actualcost || row.cost || row.spend);

        const budgetVariance = Math.round((actualCost - plannedBudget) * 100) / 100;
        const budgetVariancePct = plannedBudget > 0 ? Math.round((budgetVariance / plannedBudget) * 1000) / 10 : 0.0;

        let budgetStatus = 'On Budget';
        if (budgetVariance > 100) budgetStatus = 'Over Budget';
        else if (budgetVariance < -100) budgetStatus = 'Under Budget';

        let timelineStatus = 'On Time';
        let delayDays = 0;
        if (plannedEndDate && actualEndDate) {
          const tPlan = new Date(plannedEndDate).getTime();
          const tAct = new Date(actualEndDate).getTime();
          if (tAct > tPlan) {
            delayDays = Math.round((tAct - tPlan) / (1000 * 60 * 60 * 24));
            if (delayDays > 3) timelineStatus = 'Delayed';
          }
        }

        // ── Validation Pipeline Check ─────────────────────────────────
        const valResult = await validationPipeline.validateProject({
          external_project_id: externalProjectId,
          project_name: projectName,
          customer_name: customerName,
          planned_budget: plannedBudget,
          actual_cost: actualCost,
          start_date: startDate,
          planned_end_date: plannedEndDate,
          actual_end_date: actualEndDate
        });

        if (!valResult.isValid) {
          recordsFailed++;
          for (const err of valResult.hardErrors) {
            await logSyncError(runId, 'google_sheets_projects', err.rule, err.message, { rowIdx: idx + 1, projectName, customerName });
          }
          continue;
        }

        // Upsert Customer
        const normalizedName = customerName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
        const custRes = await pool.query(
          `INSERT INTO customers (name, normalized_name)
           VALUES ($1, $2)
           ON CONFLICT (id) DO NOTHING
           RETURNING id`,
          [customerName, normalizedName]
        );
        let customerId = custRes.rows[0]?.id;
        if (!customerId) {
          const findCust = await pool.query(`SELECT id FROM customers WHERE normalized_name = $1 LIMIT 1`, [normalizedName]);
          customerId = findCust.rows[0]?.id || null;
        }

        // Upsert Project
        const upsertSql = `
          INSERT INTO projects (
            external_project_id, s_no, customer_id, customer_name, project_name,
            status, project_type, start_date, planned_end_date, actual_end_date,
            planned_budget, actual_cost, timeline_status, budget_status,
            budget_variance, budget_variance_pct, delay_days, raw_record, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP)
          ON CONFLICT (external_project_id) DO UPDATE SET
            customer_id = EXCLUDED.customer_id,
            customer_name = EXCLUDED.customer_name,
            project_name = EXCLUDED.project_name,
            status = EXCLUDED.status,
            project_type = EXCLUDED.project_type,
            start_date = EXCLUDED.start_date,
            planned_end_date = EXCLUDED.planned_end_date,
            actual_end_date = EXCLUDED.actual_end_date,
            planned_budget = EXCLUDED.planned_budget,
            actual_cost = EXCLUDED.actual_cost,
            timeline_status = EXCLUDED.timeline_status,
            budget_status = EXCLUDED.budget_status,
            budget_variance = EXCLUDED.budget_variance,
            budget_variance_pct = EXCLUDED.budget_variance_pct,
            delay_days = EXCLUDED.delay_days,
            raw_record = EXCLUDED.raw_record,
            updated_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS is_inserted;
        `;

        const params = [
          externalProjectId,
          String(sNo),
          customerId,
          customerName,
          projectName,
          status,
          projectType,
          startDate,
          plannedEndDate,
          actualEndDate,
          plannedBudget,
          actualCost,
          timelineStatus,
          budgetStatus,
          budgetVariance,
          budgetVariancePct,
          delayDays,
          JSON.stringify(row)
        ];

        const pRes = await pool.query(upsertSql, params);
        if (pRes.rows[0]?.is_inserted) recordsInserted++;
        else recordsUpdated++;
      } catch (rowErr) {
        recordsFailed++;
        await logSyncError(runId, 'google_sheets_projects', 'ROW_INGEST_ERROR', rowErr.message, { row });
      }
    }

    await setLastSyncedAt('google_sheets_projects', new Date());

    const finalStatus = recordsFailed > 0 ? (recordsInserted + recordsUpdated > 0 ? 'partial' : 'error') : 'success';
    const message = `Ingested ${recordsInserted} new projects, updated ${recordsUpdated} projects (${recordsFailed} failed) from Google Sheets.`;

    await finishSyncRun(runId, finalStatus, {
      recordsRead,
      recordsInserted,
      recordsUpdated,
      recordsFailed,
      message
    });

    console.log(`[sheetsSync] ✅ ${message} (${Date.now() - startedAt}ms)`);
    return {
      status: finalStatus,
      recordsRead,
      recordsInserted,
      recordsUpdated,
      recordsFailed,
      message
    };
  } catch (err) {
    console.error('[sheetsSync] 💥 Projects sync failed:', err);
    await logSyncError(runId, 'google_sheets_projects', 'FATAL_SYNC_ERROR', err.message);
    await finishSyncRun(runId, 'error', {
      recordsRead,
      recordsInserted,
      recordsUpdated,
      recordsFailed,
      error: err.message
    });
    return { status: 'error', message: err.message };
  }
}

module.exports = {
  syncProjectsSheetToPostgres
};
