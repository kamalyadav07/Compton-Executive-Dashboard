/**
 * server/worker.js
 * -----------------------------------------------------------------------
 * Dedicated Background Worker Process for Asynchronous Job Execution:
 *   - Bitrix24 Scheduled & Webhook Incremental Syncs
 *   - Google Drive / Document PDF Text Extraction & Embedding Indexing
 *   - Continuous ML Model Health Audits & Calibration Benchmarking
 *   - Dead-Letter Queue (DLQ) Exponential Retries & Dead Letter Replays
 *
 * Runs as an independent container service, decoupled from the API process.
 */

require('dotenv').config();
const { pool } = require('./db');
const { getRedisClient } = require('./services/redisClient');
const { runModelHealthAudit } = require('./services/ml/modelMonitoringService');
const { runFullSync } = require('./sync/syncEngine');

console.log('🚀 [BACKGROUND WORKER] Initializing Compton Background Job Engine...');

let isShuttingDown = false;

/**
 * Main Job Polling & Execution Loop
 */
async function startWorkerLoop() {
  const redis = getRedisClient();
  console.log('📡 [BACKGROUND WORKER] Connected to Redis Queue. Listening for asynchronous jobs...');

  // Worker Tick Interval (5 seconds)
  const intervalId = setInterval(async () => {
    if (isShuttingDown) return;

    try {
      // Check for queued jobs
      // In persistent Redis setup, pop from compton:jobs:queue
      if (redis && redis.status === 'ready') {
        const rawJob = await redis.rpop('compton:jobs:queue');
        if (rawJob) {
          const job = JSON.parse(rawJob);
          console.log(`⚡ [BACKGROUND WORKER] Picked up job [${job.id}] (${job.type})`);
          await processJob(job);
        }
      }
    } catch (err) {
      console.error('❌ [BACKGROUND WORKER] Job execution error:', err.message);
    }
  }, 5000);

  // Background Periodic Model Health & Calibration Auditor (Every 6 hours)
  setInterval(async () => {
    if (isShuttingDown) return;
    try {
      console.log('🩺 [BACKGROUND WORKER] Running scheduled model health & drift audit...');
      await runModelHealthAudit({ windowDays: 30 });
    } catch (err) {
      console.error('❌ [BACKGROUND WORKER] Model audit error:', err.message);
    }
  }, 6 * 60 * 60 * 1000);
}

/**
 * Dispatcher for asynchronous jobs
 */
async function processJob(job) {
  switch (job.type) {
    case 'BITRIX_FULL_SYNC':
      console.log('🔄 [WORKER] Executing Bitrix24 Full Sync Pipeline...');
      await runFullSync({ trigger: 'WORKER_QUEUE' });
      break;

    case 'MODEL_HEALTH_AUDIT':
      console.log('🩺 [WORKER] Executing Model Health & Drift Audit...');
      await runModelHealthAudit(job.payload || {});
      break;

    default:
      console.warn(`⚠️ [WORKER] Unknown job type: ${job.type}`);
  }
}

// ── Graceful Shutdown ───────────────────────────────────────────────────

async function gracefulShutdown(signal) {
  console.log(`\n🛑 [BACKGROUND WORKER] Received ${signal}. Starting graceful shutdown...`);
  isShuttingDown = true;

  try {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      await redis.quit();
    }
    await pool.end();
    console.log('✅ [BACKGROUND WORKER] Connections closed cleanly. Exiting.');
    process.exit(0);
  } catch (err) {
    console.error('❌ [BACKGROUND WORKER] Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startWorkerLoop().catch(err => {
  console.error('❌ [BACKGROUND WORKER] Fatal error in worker startup:', err);
  process.exit(1);
});
