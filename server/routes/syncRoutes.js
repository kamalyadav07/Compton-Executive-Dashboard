/**
 * server/routes/syncRoutes.js
 * -----------------------------------------------------------------------
 * API Routes for Job Queue, Worker Monitoring, DLQ and Persistent Drift.
 */

const express = require('express');
const router = express.Router();
const { enqueueSyncJob, getDlqEntries, replayDlqJob } = require('../services/queueService');
const { getPersistentBaseline, computeRollingBaseline } = require('../services/driftService');

// ── 1. POST /api/sync/enqueue ───────────────────────────────────────────
router.post('/enqueue', async (req, res) => {
  try {
    const jobType = req.body.jobType || 'bitrix_sync';
    const payload = req.body.payload || {};
    const job = await enqueueSyncJob(jobType, payload);
    res.json({ success: true, job });
  } catch (err) {
    console.error('[syncRoutes] /enqueue error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 2. GET /api/sync/dlq ────────────────────────────────────────────────
router.get('/dlq', async (req, res) => {
  try {
    const dlq = await getDlqEntries();
    res.json(dlq);
  } catch (err) {
    console.error('[syncRoutes] /dlq error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 3. POST /api/sync/dlq/:id/replay ────────────────────────────────────
router.post('/dlq/:id/replay', async (req, res) => {
  try {
    const replayed = await replayDlqJob(req.params.id);
    res.json({ success: true, job: replayed });
  } catch (err) {
    console.error('[syncRoutes] /dlq/replay error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 4. GET /api/drift/baseline ──────────────────────────────────────────
router.get('/drift-baseline', async (req, res) => {
  try {
    const baseline = await getPersistentBaseline();
    res.json(baseline);
  } catch (err) {
    console.error('[syncRoutes] /drift-baseline error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
