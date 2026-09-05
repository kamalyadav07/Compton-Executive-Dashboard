/**
 * server/routes/modelMonitoringRoutes.js
 * -----------------------------------------------------------------------
 * API Endpoints for Continuous ML Model Monitoring & Drift Tracking.
 */

const express = require('express');
const router = express.Router();
const { 
  runModelHealthAudit, 
  getMonitoringHistory, 
  backfillResolvedOutcomes 
} = require('../services/ml/modelMonitoringService');

// ── 1. GET /api/model-monitoring/latest ──────────────────────────────────
router.get('/latest', async (req, res) => {
  try {
    const windowDays = parseInt(req.query.windowDays || '30', 10);
    const audit = await runModelHealthAudit({ windowDays });
    res.json(audit);
  } catch (err) {
    console.error('[modelMonitoringRoutes] /latest error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 2. GET /api/model-monitoring/history ─────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '12', 10);
    const history = await getMonitoringHistory(limit);
    res.json(history);
  } catch (err) {
    console.error('[modelMonitoringRoutes] /history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 3. POST /api/model-monitoring/run ────────────────────────────────────
router.post('/run', async (req, res) => {
  try {
    const windowDays = parseInt(req.body.windowDays || '30', 10);
    const audit = await runModelHealthAudit({ windowDays });
    res.json({ success: true, audit });
  } catch (err) {
    console.error('[modelMonitoringRoutes] /run error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 4. POST /api/model-monitoring/reconcile ──────────────────────────────
router.post('/reconcile', async (req, res) => {
  try {
    const reconciledCount = await backfillResolvedOutcomes();
    res.json({ success: true, reconciledCount });
  } catch (err) {
    console.error('[modelMonitoringRoutes] /reconcile error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
