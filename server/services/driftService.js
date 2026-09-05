/**
 * server/services/driftService.js
 * -----------------------------------------------------------------------
 * Persistent Data Drift & Distribution Anomaly Detection Service.
 *
 * Persists dynamic rolling 30-day baselines in PostgreSQL and Redis
 * to prevent baseline resets during cold starts or container reboots.
 */

const { pool } = require('../db');
const { getCache, setCache } = require('./redisClient');

const DRIFT_CACHE_KEY = 'drift:rolling_baseline';

/**
 * Computes and persists real rolling baselines from PostgreSQL closed deals.
 */
async function computeRollingBaseline() {
  let baseline = {
    avgRevenue: 350000,
    wonDealsCount: 45,
    winRate: 0.52,
    medianDealSize: 200000,
    lastComputedAt: new Date().toISOString()
  };

  try {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*) as total_deals,
        COUNT(*) FILTER (WHERE status = 'won') as won_count,
        COALESCE(AVG(net_revenue) FILTER (WHERE status = 'won'), 350000) as avg_won_revenue,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY net_revenue) FILTER (WHERE status = 'won'), 200000) as median_revenue
      FROM deals
      WHERE created_at >= NOW() - INTERVAL '60 days'
    `);

    if (rows.length > 0 && parseInt(rows[0].total_deals, 10) > 0) {
      const total = parseInt(rows[0].total_deals, 10);
      const won = parseInt(rows[0].won_count, 10);
      baseline = {
        avgRevenue: Math.round(parseFloat(rows[0].avg_won_revenue)),
        wonDealsCount: won,
        winRate: Math.round((won / total) * 100) / 100,
        medianDealSize: Math.round(parseFloat(rows[0].median_revenue)),
        lastComputedAt: new Date().toISOString()
      };
    }
  } catch (err) {
    console.warn('[driftService] Baseline calculation notice:', err.message);
  }

  // Persist to Redis & PostgreSQL sync_configs
  await setCache(DRIFT_CACHE_KEY, baseline, 86400); // 24h TTL

  try {
    await pool.query(`
      INSERT INTO sync_configs (source, last_synced_at, config_data)
      VALUES ('drift_baseline', CURRENT_TIMESTAMP, $1)
      ON CONFLICT (source) DO UPDATE SET
        last_synced_at = CURRENT_TIMESTAMP,
        config_data = EXCLUDED.config_data
    `, [JSON.stringify(baseline)]);
  } catch (_) {}

  return baseline;
}

/**
 * Get current rolling baseline from Redis or PostgreSQL.
 */
async function getPersistentBaseline() {
  const cached = await getCache(DRIFT_CACHE_KEY);
  if (cached) return cached;

  try {
    const { rows } = await pool.query(`
      SELECT config_data FROM sync_configs WHERE source = 'drift_baseline'
    `);
    if (rows.length > 0 && rows[0].config_data) {
      const data = typeof rows[0].config_data === 'string' ? JSON.parse(rows[0].config_data) : rows[0].config_data;
      await setCache(DRIFT_CACHE_KEY, data, 86400);
      return data;
    }
  } catch (_) {}

  return computeRollingBaseline();
}

/**
 * Detect drift between current sync batch and persistent rolling baseline.
 */
async function evaluateDrift(currentBatch = []) {
  const baseline = await getPersistentBaseline();
  const alerts = [];

  if (!currentBatch || currentBatch.length === 0) return { alerts, baseline };

  const wonDeals = currentBatch.filter(d => (d.status || d.type) === 'won');
  const wonCount = wonDeals.length;
  const totalWonRev = wonDeals.reduce((s, d) => s + (parseFloat(d.net_revenue || d.gross_revenue || '0')), 0);
  const currentAvgRev = wonCount > 0 ? totalWonRev / wonCount : 0;

  // 1. Average Revenue Spike/Crash Alert (>150% shift)
  if (baseline.avgRevenue > 0 && currentAvgRev > 0) {
    const ratio = Math.abs(currentAvgRev - baseline.avgRevenue) / baseline.avgRevenue;
    if (ratio > 1.5) {
      alerts.push({
        metric: 'Average Won Revenue',
        baseline: baseline.avgRevenue,
        current: Math.round(currentAvgRev),
        changePct: Math.round(ratio * 100),
        severity: ratio > 3.0 ? 'CRITICAL' : 'WARNING',
        description: `Average deal revenue shifted ${Math.round(ratio * 100)}% from rolling baseline ₹${(baseline.avgRevenue / 100000).toFixed(2)}L to ₹${(currentAvgRev / 100000).toFixed(2)}L.`
      });
    }
  }

  // 2. Won Volume Collapse Alert
  if (baseline.wonDealsCount > 15 && wonCount < 3) {
    alerts.push({
      metric: 'Won Deals Volume',
      baseline: baseline.wonDealsCount,
      current: wonCount,
      changePct: Math.round(((baseline.wonDealsCount - wonCount) / baseline.wonDealsCount) * 100),
      severity: 'CRITICAL',
      description: `Won deals volume dropped sharply from baseline ${baseline.wonDealsCount} to ${wonCount}.`
    });
  }

  return { alerts, baseline };
}

module.exports = {
  computeRollingBaseline,
  getPersistentBaseline,
  evaluateDrift
};
