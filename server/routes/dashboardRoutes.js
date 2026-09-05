/**
 * server/routes/dashboardRoutes.js
 * -----------------------------------------------------------------------
 * Express Routes for PostgreSQL-backed Dashboard KPIs & Analytics.
 * Includes short TTL in-memory caching (45 seconds) to eliminate redundant queries.
 */

const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboardService');
const { isDatabaseConfigured } = require('../db');

// If PostgreSQL is not configured, inform the client gracefully so it uses client-side calculation
router.use((req, res, next) => {
  if (req.path === '/cache/clear') return next();
  if (isDatabaseConfigured && !isDatabaseConfigured()) {
    return res.status(503).json({
      configured: false,
      error: 'PostgreSQL database is not configured. Dashboard is running in client calculation mode.'
    });
  }
  next();
});

// ── In-Memory Response Cache (45s TTL) ──────────────────────────────────

const cache = new Map();
const CACHE_TTL_MS = 45 * 1000;

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function clearCache() {
  cache.clear();
}

// ── Helper to parse query string to filter object ───────────────────────

function parseFiltersFromQuery(query) {
  return {
    startDate: query.startDate || null,
    endDate: query.endDate || null,
    selectedMonth: query.selectedMonth || query.month || null,
    selectedQuarter: query.selectedQuarter || query.quarter || null,
    selectedYear: query.selectedYear || query.year || null,
    salesRep: query.salesRep || null,
    industry: query.industry || null,
    solution: query.solution || null,
    leadSource: query.leadSource || null,
    pipelineStage: query.pipelineStage || query.stage || null,
    customerQuery: query.customerQuery || query.customer || null,
    dealQuery: query.dealQuery || query.deal || null,
    companyQuery: query.companyQuery || query.company || null,
    minDealValue: query.minDealValue ? parseFloat(query.minDealValue) : null,
    maxDealValue: query.maxDealValue ? parseFloat(query.maxDealValue) : null
  };
}

// ── 1. GET /api/dashboard/summary ───────────────────────────────────────

router.get('/summary', async (req, res) => {
  const cacheKey = `summary:${req.originalUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const filters = parseFiltersFromQuery(req.query);
    const summary = await dashboardService.getDashboardSummary(filters);
    setCached(cacheKey, summary);
    res.json(summary);
  } catch (err) {
    console.error('[dashboardRoutes] /summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 2. GET /api/dashboard/revenue ───────────────────────────────────────

router.get('/revenue', async (req, res) => {
  const cacheKey = `revenue:${req.originalUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const filters = parseFiltersFromQuery(req.query);
    const revenue = await dashboardService.getRevenueAnalytics(filters);
    setCached(cacheKey, revenue);
    res.json(revenue);
  } catch (err) {
    console.error('[dashboardRoutes] /revenue error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 3. GET /api/dashboard/pipeline ──────────────────────────────────────

router.get('/pipeline', async (req, res) => {
  const cacheKey = `pipeline:${req.originalUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const filters = parseFiltersFromQuery(req.query);
    const pipeline = await dashboardService.getPipelineAnalytics(filters);
    setCached(cacheKey, pipeline);
    res.json(pipeline);
  } catch (err) {
    console.error('[dashboardRoutes] /pipeline error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 4. GET /api/dashboard/win-rate ──────────────────────────────────────

router.get('/win-rate', async (req, res) => {
  const cacheKey = `win-rate:${req.originalUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const filters = parseFiltersFromQuery(req.query);
    const winRate = await dashboardService.getWinRateAnalytics(filters);
    setCached(cacheKey, winRate);
    res.json(winRate);
  } catch (err) {
    console.error('[dashboardRoutes] /win-rate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 5. GET /api/dashboard/sales-reps ────────────────────────────────────

router.get('/sales-reps', async (req, res) => {
  const cacheKey = `sales-reps:${req.originalUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const filters = parseFiltersFromQuery(req.query);
    const reps = await dashboardService.getSalesRepAnalytics(filters);
    setCached(cacheKey, reps);
    res.json(reps);
  } catch (err) {
    console.error('[dashboardRoutes] /sales-reps error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 6. GET /api/dashboard/forecast ──────────────────────────────────────

const { computeSalesForecast } = require('../services/forecastService');

router.get('/forecast', async (req, res) => {
  const cacheKey = `forecast:${req.originalUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const scope = (req.query.period || req.query.scope || 'month').toLowerCase();
    const asOf = req.query.asOf ? new Date(req.query.asOf) : new Date();
    const forecast = await computeSalesForecast({ scope, asOf });

    setCached(cacheKey, forecast);
    res.json(forecast);
  } catch (err) {
    console.error('[dashboardRoutes] /forecast error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 7. GET /api/dashboard/projects ──────────────────────────────────────

router.get('/projects', async (req, res) => {
  const cacheKey = `projects:${req.originalUrl}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const projectsData = await dashboardService.getProjectAnalytics(req.query);
    setCached(cacheKey, projectsData);
    res.json(projectsData);
  } catch (err) {
    console.error('[dashboardRoutes] /projects error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Cache Clear Route ───────────────────────────────────────────────────

router.post('/cache/clear', (_req, res) => {
  clearCache();
  res.json({ status: 'cleared', message: 'Dashboard cache cleared.' });
});

module.exports = {
  router,
  clearCache
};
