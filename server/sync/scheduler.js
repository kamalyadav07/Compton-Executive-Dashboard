/**
 * server/sync/scheduler.js
 * -----------------------------------------------------------------------
 * Sync Scheduler & API Route Controller for PostgreSQL ETL.
 *
 * Provides:
 *   - Background periodic worker (for persistent Node.js instances)
 *   - Protected REST endpoints for on-demand & Vercel Cron triggers
 *   - Observability endpoints for sync_runs and health tracking
 */

const { syncBitrixToPostgres } = require('./bitrixSync');
const { syncProjectsSheetToPostgres } = require('./sheetsSync');
const { getRecentSyncRuns, getLastSyncedAt } = require('./syncLogger');

let isSyncRunning = false;
let schedulerTimer = null;

/**
 * Execute both Bitrix and Sheets sync pipelines sequentially.
 */
async function runAllSyncs(options = {}) {
  if (isSyncRunning) {
    console.log('[scheduler] Sync already in progress, skipping concurrent trigger.');
    return { status: 'skipped', message: 'Sync already running' };
  }

  isSyncRunning = true;
  console.log('\n🔄 [scheduler] Starting complete data sync (Bitrix24 + Google Sheets)...');
  const results = {};

  try {
    results.bitrix = await syncBitrixToPostgres(options);
  } catch (bErr) {
    results.bitrix = { status: 'error', message: bErr.message };
  }

  try {
    results.sheets = await syncProjectsSheetToPostgres();
  } catch (sErr) {
    results.sheets = { status: 'error', message: sErr.message };
  }

  isSyncRunning = false;
  console.log('🏁 [scheduler] Complete data sync finished.\n');
  return results;
}

/**
 * Start periodic background scheduler timer.
 */
function startSyncScheduler(intervalMs = 300000) {
  if (schedulerTimer) clearInterval(schedulerTimer);

  console.log(`⏱️ [scheduler] Initializing periodic sync scheduler (interval: ${intervalMs / 1000}s)`);

  // Run initial sync shortly after startup (after 5 seconds)
  setTimeout(() => {
    runAllSyncs().catch(() => {});
  }, 5000);

  // Set recurring interval
  schedulerTimer = setInterval(() => {
    runAllSyncs().catch(() => {});
  }, intervalMs);
}

/**
 * Register Express Sync API routes.
 */
function registerSyncRoutes(app, rateLimiter = null) {
  const middleware = rateLimiter ? [rateLimiter] : [];

  // Middleware for Vercel Cron secret validation (optional security)
  const verifyCronSecret = (req, res, next) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return next(); // Not configured, proceed

    const authHeader = req.headers.authorization || req.headers['x-cron-secret'];
    if (authHeader === `Bearer ${cronSecret}` || authHeader === cronSecret) {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET' });
  };

  // ── Trigger Bitrix Sync Endpoint ──────────────────────────────────────
  app.post('/api/sync/bitrix', ...middleware, async (req, res) => {
    try {
      const forceFullSync = req.body?.forceFullSync === true || req.query?.force === 'true';
      const result = await syncBitrixToPostgres({ forceFullSync });
      res.json(result);
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // ── Trigger Google Sheets Sync Endpoint ──────────────────────────────
  app.post('/api/sync/sheets', ...middleware, async (_req, res) => {
    try {
      const result = await syncProjectsSheetToPostgres();
      res.json(result);
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // ── Trigger All Syncs Endpoint (Bitrix + Sheets) ─────────────────────
  app.post('/api/sync/all', ...middleware, async (req, res) => {
    try {
      const forceFullSync = req.body?.forceFullSync === true;
      const result = await runAllSyncs({ forceFullSync });
      res.json(result);
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // ── Vercel Cron Trigger Endpoint ─────────────────────────────────────
  app.get('/api/sync/cron', verifyCronSecret, async (_req, res) => {
    try {
      console.log('[cron] Vercel Cron trigger received.');
      const result = await runAllSyncs();
      res.json({ cron: 'executed', results: result });
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // ── Sync Audit History (for Admin View & Observability) ───────────────
  app.get('/api/sync/runs', async (req, res) => {
    const limit = parseInt(req.query.limit || '25', 10);
    const runs = await getRecentSyncRuns(limit);
    const lastBitrix = await getLastSyncedAt('bitrix24');
    const lastSheets = await getLastSyncedAt('google_sheets_projects');

    res.json({
      runs,
      lastSyncedAt: {
        bitrix: lastBitrix,
        sheets: lastSheets
      },
      isSyncRunning
    });
  });

  // ── 6-Dimensional Data Quality Snapshot Endpoint ──────────────────────
  const { validationPipeline } = require('../services/validationService');
  app.get('/api/data-quality/latest', async (_req, res) => {
    try {
      const snapshot = await validationPipeline.getLatestDataQualitySnapshot();
      res.json(snapshot);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = {
  runAllSyncs,
  startSyncScheduler,
  registerSyncRoutes
};
