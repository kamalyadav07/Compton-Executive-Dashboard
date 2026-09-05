/**
 * server/routes/telemetryRoutes.js
 * -----------------------------------------------------------------------
 * OpenTelemetry & Observability API Endpoints.
 */

const express = require('express');
const router = express.Router();
const { getTelemetrySummary, generatePrometheusMetrics } = require('../services/telemetryService');

// ── 1. GET /api/telemetry/metrics (JSON) ─────────────────────────────────
router.get('/metrics', (req, res) => {
  try {
    const summary = getTelemetrySummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 2. GET /api/telemetry/prometheus (OpenTelemetry / Prometheus Text) ───
router.get('/prometheus', (req, res) => {
  try {
    const text = generatePrometheusMetrics();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(text);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
