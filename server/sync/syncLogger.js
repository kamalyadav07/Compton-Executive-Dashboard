/**
 * server/sync/syncLogger.js
 * -----------------------------------------------------------------------
 * Manages audit logging for sync runs and Dead Letter Queue (DLQ) errors
 * in PostgreSQL.
 */

const { pool, isDatabaseConfigured } = require('../db');

/**
 * Start a new sync run and return its unique UUID.
 */
async function startSyncRun(source) {
  if (isDatabaseConfigured && !isDatabaseConfigured()) {
    return { id: null, started_at: new Date() };
  }
  try {
    const res = await pool.query(
      `INSERT INTO sync_runs (source, status, started_at, records_fetched, records_inserted, records_updated, records_failed)
       VALUES ($1, 'running', CURRENT_TIMESTAMP, 0, 0, 0, 0)
       RETURNING id, started_at`,
      [source]
    );
    return res.rows[0];
  } catch (err) {
    if (err.code !== 'DATABASE_NOT_CONFIGURED') {
      console.warn(`[syncLogger] Failed to insert initial sync_runs row for ${source}:`, err.message);
    }
    // Fallback pseudo-run object if DB is temporarily disconnected
    return { id: null, started_at: new Date() };
  }
}

/**
 * Log an individual record or network fault to the sync_errors DLQ table.
 */
async function logSyncError(runId, source, errorType, errorMessage, payload = null) {
  if (isDatabaseConfigured && !isDatabaseConfigured()) return;
  try {
    await pool.query(
      `INSERT INTO sync_errors (sync_run_id, source, error_type, error_message, payload, occurred_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [runId, source, errorType, String(errorMessage).slice(0, 1000), payload ? JSON.stringify(payload) : null]
    );
  } catch (err) {
    if (err.code !== 'DATABASE_NOT_CONFIGURED') {
      console.warn(`[syncLogger] Failed to log sync error:`, err.message);
    }
  }
}

/**
 * Finalize a sync run with complete statistics, duration, and final status.
 */
async function finishSyncRun(runId, status, stats = {}) {
  const {
    recordsRead = 0,
    recordsInserted = 0,
    recordsUpdated = 0,
    recordsFailed = 0,
    error = null,
    message = ''
  } = stats;

  if (!runId || (isDatabaseConfigured && !isDatabaseConfigured())) return;

  try {
    await pool.query(
      `UPDATE sync_runs
       SET status = $1,
           records_fetched = $2,
           records_inserted = $3,
           records_updated = $4,
           records_failed = $5,
           error = $6,
           message = $7,
           completed_at = CURRENT_TIMESTAMP,
           duration_ms = EXTRACT(MILLISECONDS FROM (CURRENT_TIMESTAMP - started_at))::INTEGER
       WHERE id = $8`,
      [
        status,
        recordsRead,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
        error ? String(error).slice(0, 2000) : null,
        message || (error ? `Failed: ${error}` : `Completed ${status}`),
        runId
      ]
    );
  } catch (err) {
    if (err.code !== 'DATABASE_NOT_CONFIGURED') {
      console.warn(`[syncLogger] Failed to update sync_runs row ${runId}:`, err.message);
    }
  }
}

/**
 * Fetch the latest successful sync timestamp for incremental querying.
 */
async function getLastSyncedAt(source) {
  if (isDatabaseConfigured && !isDatabaseConfigured()) return null;
  try {
    // 1. Check sync_configs first for explicit cursor
    const configRes = await pool.query(
      `SELECT value FROM sync_configs WHERE key = $1`,
      [`last_synced_at_${source}`]
    );
    if (configRes.rows.length > 0 && configRes.rows[0].value) {
      return new Date(configRes.rows[0].value);
    }

    // 2. Fallback to latest successful sync_runs completion
    const runRes = await pool.query(
      `SELECT completed_at FROM sync_runs
       WHERE source = $1 AND status = 'success' AND completed_at IS NOT NULL
       ORDER BY completed_at DESC
       LIMIT 1`,
      [source]
    );
    if (runRes.rows.length > 0 && runRes.rows[0].completed_at) {
      return new Date(runRes.rows[0].completed_at);
    }
  } catch (err) {
    if (err.code !== 'DATABASE_NOT_CONFIGURED') {
      console.warn(`[syncLogger] Could not retrieve last_synced_at for ${source}:`, err.message);
    }
  }
  return null;
}

/**
 * Store the latest successful sync timestamp.
 */
async function setLastSyncedAt(source, date = new Date()) {
  if (isDatabaseConfigured && !isDatabaseConfigured()) return;
  try {
    const isoString = date instanceof Date ? date.toISOString() : new Date(date).toISOString();
    await pool.query(
      `INSERT INTO sync_configs (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [`last_synced_at_${source}`, isoString]
    );
  } catch (err) {
    if (err.code !== 'DATABASE_NOT_CONFIGURED') {
      console.warn(`[syncLogger] Failed to set last_synced_at for ${source}:`, err.message);
    }
  }
}

/**
 * Retrieve the latest N sync runs for UI observability.
 */
async function getRecentSyncRuns(limit = 25) {
  if (isDatabaseConfigured && !isDatabaseConfigured()) return [];
  try {
    const res = await pool.query(
      `SELECT r.*, 
              (SELECT COUNT(*) FROM sync_errors e WHERE e.sync_run_id = r.id) as error_count
       FROM sync_runs r
       ORDER BY r.started_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  } catch (err) {
    if (err.code !== 'DATABASE_NOT_CONFIGURED') {
      console.warn(`[syncLogger] Failed to query recent sync_runs:`, err.message);
    }
    return [];
  }
}

module.exports = {
  startSyncRun,
  logSyncError,
  finishSyncRun,
  getLastSyncedAt,
  setLastSyncedAt,
  getRecentSyncRuns
};
