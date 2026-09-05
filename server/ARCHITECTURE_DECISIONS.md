# Architecture Decision Record (ADR): Background Queue & Worker Host

## ADR-001: Persistent Worker Architecture vs. Pure Serverless

### Context & Problem Statement
The Compton Executive Dashboard syncs hundreds of deals, contacts, activities, and documents from Bitrix24 and Google Sheets.
Under a pure Vercel serverless function environment:
1. **Execution Timeouts:** Free Vercel functions have a hard 10s timeout (60s on Pro). Bitrix paginated rate-limited fetches routinely take 45–120s.
2. **Cold Start State Loss:** In-memory queues (`bitrixFetchQueue.ts`, `DLQService.ts`, `EventBus.ts`) and drift detection baselines are wiped clean on every lambda lifecycle event.
3. **Silent Sync Failures:** Network glitches or 429 throttling result in dropped sync runs with no retry persistence.

---

### Decision
We adopt **Upstash Redis + Persistent Worker Host (Railway / Render / Express Container)** with fallback to PostgreSQL-backed queuing.

### Why this option:
- **Upstash Redis:** Provides serverless REST and standard Redis protocol with generous free tier (10,000 commands/day), sub-millisecond key-value caching, and persistent DLQ buffers.
- **Worker Host (Render / Railway / Fly.io / Local Daemon):** Allows continuous long-running BullMQ-style worker loops that gracefully handle rate limits with exponential backoff (Retry 1 → Retry 2 → Retry 3 → DLQ) and distributed mutex locking (`redis.set('lock:bitrix_sync', 'locked', 'PX', 60000, 'NX')`).

---

### Architecture Workflow:

```
[UI / Webhook / Cron] 
       │ (POST /api/sync/enqueue)
       ▼
[Redis Job Queue / sync_runs table]
       │ (Atomic Pop & Distributed Lock)
       ▼
[Persistent Sync Worker] ──(Retry 1, 2, 3)──► [Bitrix24 API / Sheets]
       │                                              │
       ├─► [Success] ──► [PostgreSQL Database] ◄──────┘
       │
       └─► [3x Failure] ──► [Dead Letter Queue (DLQ)] ──► [Platform Control Center UI]
```
