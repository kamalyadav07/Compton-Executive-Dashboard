/**
 * bitrixFetchQueue.ts
 * -----------------------------------------------------------------------
 * ROOT CAUSE of "takes 30s and sometimes only loads half data":
 *
 * The current code (bitrixService.ts) fires dozens of `fetch()` calls to
 * Bitrix at once via Promise.all with NO throttling:
 *    - crm.deal.list.json pages: all offsets fetched in parallel
 *    - crm.lead.list.json pages: all offsets fetched in parallel
 *    - a batch.json call PER 25 deals, all fired in parallel too
 *
 * Bitrix24 webhooks enforce an undocumented-but-real rate limit
 * (~2 requests/second per webhook, burstable a bit, then HTTP 503 /
 * QUERY_LIMIT_EXCEEDED). Every failing request in this codebase is
 * wrapped in `.catch(() => [])` or `.catch(() => null)` — so when Bitrix
 * throttles a request, it doesn't throw or retry, it just silently
 * returns an EMPTY array. That page of deals / that batch of comments
 * quietly disappears from the dashboard. That is exactly the "sometimes
 * only loads half data" symptom, and it's silent, so you don't find out
 * until you refresh and get a different (also possibly wrong) total.
 *
 * FIX: a small concurrency + rate-limited queue with exponential-backoff
 * retry. Same total data, same "parallel where safe" speed benefit, but
 * it never silently drops a page — it retries, and only gives up (with a
 * VISIBLE error, not a silent empty array) after N attempts.
 */

export interface QueueOptions {
  /** Max requests allowed to be in-flight at once. */
  concurrency?: number;
  /** Minimum ms between request *starts*, enforced globally (rate limit). */
  minIntervalMs?: number;
  /** Retry attempts for a failed/throttled request before giving up. */
  maxRetries?: number;
}

export class RateLimitedQueue {
  private concurrency: number;
  private minIntervalMs: number;
  private maxRetries: number;
  private active = 0;
  private lastStart = 0;
  private queue: Array<() => void> = [];

  constructor(opts: QueueOptions = {}) {
    this.concurrency = opts.concurrency ?? 4;      // Bitrix tolerates a small burst
    this.minIntervalMs = opts.minIntervalMs ?? 550; // ~1.8 req/sec sustained, safely under Bitrix's ~2/sec cap
    this.maxRetries = opts.maxRetries ?? 4;
  }

  /** Schedule a fetch. Resolves with the parsed JSON, or throws after retries are exhausted. */
  async run<T>(taskFn: () => Promise<T>, label = 'request'): Promise<T> {
    await this.acquireSlot();
    try {
      return await this.withRetry(taskFn, label);
    } finally {
      this.releaseSlot();
    }
  }

  private acquireSlot(): Promise<void> {
    return new Promise(resolve => {
      const tryStart = () => {
        const now = Date.now();
        const waitForRate = Math.max(0, this.minIntervalMs - (now - this.lastStart));
        if (this.active < this.concurrency && waitForRate === 0) {
          this.active++;
          this.lastStart = Date.now();
          resolve();
        } else {
          setTimeout(tryStart, Math.max(20, waitForRate));
        }
      };
      this.queue.push(tryStart);
      if (this.queue.length === 1 || this.active < this.concurrency) tryStart();
    });
  }

  private releaseSlot() {
    this.active = Math.max(0, this.active - 1);
    this.queue.shift();
    if (this.queue.length > 0) this.queue[0]();
  }

  private async withRetry<T>(taskFn: () => Promise<T>, label: string): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await taskFn();
        // Detect Bitrix's soft-fail shape: {error: 'QUERY_LIMIT_EXCEEDED', ...}
        if (result && typeof result === 'object' && 'error' in (result as any)) {
          const errCode = (result as any).error;
          if (errCode === 'QUERY_LIMIT_EXCEEDED' || errCode === 'OPERATION_TIME_LIMIT') {
            throw new Error(`Bitrix throttled: ${errCode}`);
          }
        }
        return result;
      } catch (err) {
        lastErr = err;
        const backoff = Math.min(8000, 400 * Math.pow(2, attempt)) + Math.random() * 250;
        console.warn(`[bitrixFetchQueue] ${label} failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${Math.round(backoff)}ms`, err);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
    // Give up LOUDLY instead of silently returning []. Callers must handle
    // this and surface it (e.g. a toast: "12 of 480 deals failed to sync,
    // retrying in background") instead of pretending the data is complete.
    throw new Error(`[bitrixFetchQueue] ${label} permanently failed after ${this.maxRetries + 1} attempts: ${String(lastErr)}`);
  }
}

/**
 * Fetch every page of a paginated Bitrix `*.list.json` endpoint reliably.
 * Replaces the ad-hoc "Promise.all over every offset" pattern used for
 * both crm.deal.list.json and crm.lead.list.json.
 *
 * Returns { items, failedPages } so the caller can show an honest partial-
 * data warning instead of presenting incomplete data as if it were whole.
 */
export async function fetchAllPagesReliable<T = any>(
  buildUrl: (start: number) => string,
  pageSize = 50,
  queue = new RateLimitedQueue()
): Promise<{ items: T[]; total: number; failedPages: number[] }> {
  const first = await queue.run(() => fetch(buildUrl(0)).then(r => r.json()), 'page:0');
  const total: number = first.total ?? (first.result?.length ?? 0);
  let items: T[] = first.result ?? [];

  const offsets: number[] = [];
  for (let s = pageSize; s < total; s += pageSize) offsets.push(s);

  const failedPages: number[] = [];
  await Promise.all(
    offsets.map(async (start) => {
      try {
        const page = await queue.run(() => fetch(buildUrl(start)).then(r => r.json()), `page:${start}`);
        items = items.concat(page.result ?? []);
      } catch (err) {
        failedPages.push(start);
        console.error(`[fetchAllPagesReliable] Giving up on page start=${start}`, err);
      }
    })
  );

  return { items, total, failedPages };
}
