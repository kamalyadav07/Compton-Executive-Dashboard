/**
 * server/services/telemetryService.js
 * -----------------------------------------------------------------------
 * OpenTelemetry-Compatible Production Performance & Dependency Telemetry Engine.
 *
 * Measures and attributes latency and error rates across:
 *   1. API Routes (Dashboard, Chat, Sync, Documents)
 *   2. PostgreSQL Queries
 *   3. Redis / Queue Operations
 *   4. External Dependencies (Bitrix24 API, Gemini LLM, Gemini Embeddings)
 *   5. ML Inference & Hybrid Document Retrieval
 */

// ── Dependency Latency Trackers ─────────────────────────────────────────

const dependencyStats = {
  bitrix_api: { count: 0, totalMs: 0, errors: 0, lastMs: 0, maxMs: 0 },
  postgresql: { count: 0, totalMs: 0, errors: 0, lastMs: 0, maxMs: 0 },
  redis: { count: 0, totalMs: 0, errors: 0, lastMs: 0, maxMs: 0 },
  gemini_llm: { count: 0, totalMs: 0, errors: 0, lastMs: 0, maxMs: 0 },
  gemini_embeddings: { count: 0, totalMs: 0, errors: 0, lastMs: 0, maxMs: 0 },
  model_inference: { count: 0, totalMs: 0, errors: 0, lastMs: 0, maxMs: 0 },
  hybrid_retrieval: { count: 0, totalMs: 0, errors: 0, lastMs: 0, maxMs: 0 }
};

// Route Latency Buckets
const routeStats = new Map();

/**
 * Record timing for an external dependency call or internal engine execution.
 *
 * @param {'bitrix_api'|'postgresql'|'redis'|'gemini_llm'|'gemini_embeddings'|'model_inference'|'hybrid_retrieval'} dependency
 * @param {number} durationMs - Execution time in milliseconds
 * @param {boolean} [isError=false]
 */
function recordDependencyMetric(dependency, durationMs, isError = false) {
  const stat = dependencyStats[dependency];
  if (!stat) return;

  stat.count++;
  stat.totalMs += durationMs;
  stat.lastMs = Math.round(durationMs * 10) / 10;
  if (durationMs > stat.maxMs) stat.maxMs = Math.round(durationMs * 10) / 10;
  if (isError) stat.errors++;
}

/**
 * Record timing and status for an HTTP API Route.
 *
 * @param {string} route - e.g. "GET /api/dashboard/summary"
 * @param {number} durationMs - Request duration
 * @param {number} statusCode - HTTP status
 */
function recordRouteMetric(route, durationMs, statusCode = 200) {
  if (!routeStats.has(route)) {
    routeStats.set(route, {
      route,
      count: 0,
      totalMs: 0,
      lastMs: 0,
      maxMs: 0,
      errors: 0,
      durations: []
    });
  }

  const stat = routeStats.get(route);
  stat.count++;
  stat.totalMs += durationMs;
  stat.lastMs = Math.round(durationMs * 10) / 10;
  if (durationMs > stat.maxMs) stat.maxMs = Math.round(durationMs * 10) / 10;
  if (statusCode >= 400) stat.errors++;

  // Keep rolling 100 durations for percentile calculations
  stat.durations.push(durationMs);
  if (stat.durations.length > 100) stat.durations.shift();
}

/**
 * Express Middleware to automatically instrument all incoming HTTP requests.
 */
function telemetryMiddleware(req, res, next) {
  const start = Date.now();
  const route = `${req.method} ${req.baseUrl || ''}${req.path}`;

  res.on('finish', () => {
    const duration = Date.now() - start;
    recordRouteMetric(route, duration, res.statusCode);
  });

  next();
}

/**
 * Calculate comprehensive telemetry metrics summary.
 */
function getTelemetrySummary() {
  const dependencies = {};
  for (const [dep, s] of Object.entries(dependencyStats)) {
    dependencies[dep] = {
      calls: s.count,
      avgLatencyMs: s.count > 0 ? Math.round((s.totalMs / s.count) * 10) / 10 : 0,
      lastLatencyMs: s.lastMs,
      maxLatencyMs: s.maxMs,
      errorCount: s.errors,
      errorRatePct: s.count > 0 ? Math.round((s.errors / s.count) * 1000) / 10 : 0
    };
  }

  const routes = [];
  routeStats.forEach(r => {
    const sorted = [...r.durations].sort((a, b) => a - b);
    const p50 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : 0;
    const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;

    routes.push({
      route: r.route,
      requests: r.count,
      avgLatencyMs: Math.round((r.totalMs / r.count) * 10) / 10,
      p50LatencyMs: Math.round(p50 * 10) / 10,
      p95LatencyMs: Math.round(p95 * 10) / 10,
      maxLatencyMs: r.maxMs,
      errorCount: r.errors
    });
  });

  const mem = process.memoryUsage();

  return {
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: {
      rss: Math.round(mem.rss / (1024 * 1024)),
      heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
      heapTotal: Math.round(mem.heapTotal / (1024 * 1024))
    },
    dependencies,
    routes: routes.sort((a, b) => b.requests - a.requests).slice(0, 15)
  };
}

/**
 * Generate standard Prometheus / OpenTelemetry text format metrics.
 */
function generatePrometheusMetrics() {
  const lines = [
    '# HELP compton_dependency_latency_ms Average latency per external dependency in milliseconds',
    '# TYPE compton_dependency_latency_ms gauge'
  ];

  for (const [dep, s] of Object.entries(dependencyStats)) {
    const avg = s.count > 0 ? (s.totalMs / s.count).toFixed(2) : '0';
    lines.push(`compton_dependency_latency_ms{dependency="${dep}"} ${avg}`);
  }

  lines.push(
    '',
    '# HELP compton_dependency_calls_total Total calls per dependency',
    '# TYPE compton_dependency_calls_total counter'
  );
  for (const [dep, s] of Object.entries(dependencyStats)) {
    lines.push(`compton_dependency_calls_total{dependency="${dep}"} ${s.count}`);
  }

  lines.push(
    '',
    '# HELP compton_http_requests_total Total HTTP requests by route',
    '# TYPE compton_http_requests_total counter'
  );
  routeStats.forEach(r => {
    lines.push(`compton_http_requests_total{route="${r.route}"} ${r.count}`);
  });

  return lines.join('\n');
}

module.exports = {
  recordDependencyMetric,
  recordRouteMetric,
  telemetryMiddleware,
  getTelemetrySummary,
  generatePrometheusMetrics
};
