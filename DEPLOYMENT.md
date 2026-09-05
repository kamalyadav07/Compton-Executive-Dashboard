# Production Deployment Guide & Infrastructure Topology

This document details the multi-tier deployment architecture for the **Compton Executive Dashboard & Predictive Intelligence Engine**.

---

## 1. System Architecture & Topology

The system is decoupled into four independently deployable and scalable tiers:

```mermaid
graph TD
    subgraph Tier 1: Static CDN & Edge
        FE["Frontend (React + Vite SPA)<br/>Host: Vercel / Cloudflare Pages<br/>URL: https://dashboard.compton.com"]
    end

    subgraph Tier 2: Application Containers (Railway / Render / Fly.io)
        API["Backend API Process<br/>Image: Dockerfile.api<br/>Runs: node server/dashboard-server.js<br/>Scale: 1-N Replicas"]
        WORKER["Background Worker Process<br/>Image: Dockerfile.worker<br/>Runs: node server/worker.js<br/>Scale: 1 Replica (Mutex-Locked)"]
    end

    subgraph Tier 3: Managed Data Layer
        DB[("Managed PostgreSQL 16<br/>Host: Supabase / Neon / AWS RDS<br/>Pooled via pgBouncer")]
        REDIS[("Managed Redis 7<br/>Host: Upstash / Redis Cloud<br/>Queue, Mutex & Cache")]
    end

    subgraph Tier 4: External SaaS Dependencies
        BITRIX["Bitrix24 CRM Webhook API"]
        GEMINI["Google Gemini 2.5 API"]
    end

    FE -->|HTTPS REST & SSE Stream| API
    API -->|Read/Write Queries| DB
    API -->|Rate Limits & Cache| REDIS
    API -->|Intent & Citations| GEMINI
    WORKER -->|Batch Upserts| DB
    WORKER -->|BullMQ Queue Pop| REDIS
    WORKER -->|Incremental Polling| BITRIX
```

---

## 2. Environment Variables by Component

### A. Frontend SPA (Vercel / Cloudflare)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL of the containerized Backend API | `https://api.compton.com` |
| `VITE_ENVIRONMENT` | Environment identifier | `production` |

> [!WARNING]
> **Security Rule:** Never include `BITRIX_WEBHOOK_URL`, `DATABASE_URL`, or `GEMINI_API_KEY` in frontend environment variables or client-side bundles.

---

### B. Backend REST API Process (Container Service)
| Variable | Description | Example / Required |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | HTTP Port for Express server | `4000` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowed origins | `https://dashboard.compton.com` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@ep-xyz.supabase.co:5432/compton` |
| `REDIS_URL` | Upstash / Redis connection string | `rediss://default:token@xyz.upstash.io:6379` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `BITRIX_WEBHOOK_URL` | Bitrix24 Inbound Webhook URL | `https://compton.bitrix24.in/rest/1/secret_token/` |

---

### C. Background Sync Worker (Container Service)
| Variable | Description | Example / Required |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@ep-xyz.supabase.co:5432/compton` |
| `REDIS_URL` | Upstash / Redis connection string | `rediss://default:token@xyz.upstash.io:6379` |
| `BITRIX_WEBHOOK_URL` | Bitrix24 Inbound Webhook URL | `https://compton.bitrix24.in/rest/1/secret_token/` |

---

## 3. Database Migration Protocol

All database migrations are located in `server/db/migrations/` and executed sequentially with transaction safety.

### Running Migrations against Production
Run the automated migrator from your CI/CD runner or container terminal:

```bash
# Execute all pending SQL migrations (001 through 009)
npm run db:migrate
```

The migration runner records applied migrations in `schema_migrations` to guarantee idempotency.

---

## 4. Rollback & Disaster Recovery Procedures

### A. API / Worker Application Rollback
If a regression or fatal crash occurs in a new deployment:
1. **Instant Rollback via CLI/Dashboard:**
   - **Railway / Render:** Navigate to the service deployment history and click **"Rollback to previous deployment"**.
   - **Docker / Kubernetes:** `kubectl rollout undo deployment/compton-api`
2. **Restart Worker Process:**
   - Terminate the active worker instance; the container supervisor will immediately restart the previous stable image.

### B. Database Migration Rollback
If a schema migration fails midway:
1. All individual migration files are wrapped in `BEGIN ... COMMIT` blocks; failed migrations rollback automatically without partial schema corruption.
2. If schema rollback is needed manually, execute the corresponding `DOWN` statements (e.g. `DROP TABLE IF EXISTS model_monitoring_runs;`).

---

## 5. Health Checks & Observability

- **API Liveness Probe:** `GET /health` $\implies$ Returns `200 OK` with uptime.
- **OpenTelemetry Metrics:** `GET /api/telemetry/metrics` $\implies$ Dependency latency breakdown (PostgreSQL, Redis, Gemini, Bitrix).
- **Prometheus Metrics:** `GET /api/telemetry/prometheus` $\implies$ OpenTelemetry text format for scrapers.
- **Model Health & Drift:** `GET /api/model-monitoring/latest` $\implies$ Out-of-sample calibration ECE and 4D drift status.
