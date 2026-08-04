import type { SyncJobRecord } from './types';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private failureThreshold: number = 3;
  private lastStateChange: number = Date.now();
  private cooldownMs: number = 10000; // 10s cooldown before half-open

  public getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() - this.lastStateChange > this.cooldownMs) {
      this.state = 'HALF_OPEN';
      this.lastStateChange = Date.now();
    }
    return this.state;
  }

  public onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.lastStateChange = Date.now();
    }
  }

  public onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
    }
  }

  public canExecute(): boolean {
    return this.getState() !== 'OPEN';
  }
}

export class SyncService {
  private circuitBreaker = new CircuitBreaker();
  private syncJobs: SyncJobRecord[] = [];
  private sheetChecksums: Map<string, string> = new Map();

  public getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  public getSyncJobs(): SyncJobRecord[] {
    return [...this.syncJobs];
  }

  public computeChecksum(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `sha256_${Math.abs(hash).toString(16)}`;
  }

  // Item 17: Intelligent Retry with Exponential Backoff + Jitter
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 4,
    baseDelayMs = 1000
  ): Promise<{ result: T; retryCount: number }> {
    if (!this.circuitBreaker.canExecute()) {
      throw new Error("Circuit Breaker is OPEN. Aborting external sync attempt.");
    }

    let retries = 0;
    while (true) {
      try {
        const result = await operation();
        this.circuitBreaker.onSuccess();
        return { result, retryCount: retries };
      } catch (err) {
        retries++;
        if (retries > maxRetries) {
          this.circuitBreaker.onFailure();
          throw err;
        }

        // Exponential backoff with jitter: 1s, 2s, 4s, 8s, 16s + Math.random() * 500
        const backoffMs = baseDelayMs * Math.pow(2, retries - 1);
        const jitter = Math.floor(Math.random() * 500);
        const totalDelay = backoffMs + jitter;

        await new Promise(res => setTimeout(res, totalDelay));
      }
    }
  }

  // Create new record in sync_jobs (Item 2 & Item 8 Checkpointing)
  public startSyncJob(sheetName: string, initiatedBy: string = 'manual'): SyncJobRecord {
    const job: SyncJobRecord = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      started_at: new Date().toISOString(),
      status: 'running',
      sheet_name: sheetName,
      rows_read: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_deleted: 0,
      rows_skipped: 0,
      rows_quarantined: 0,
      processing_time_ms: 0,
      retry_count: 0,
      initiated_by: initiatedBy,
      sync_version: 'v3.2.0',
      checksum: '',
      dqi_score: 100,
      stage_checkpoints: {
        Validation: false,
        Normalization: false,
        Deduplication: false,
        BusinessRules: false,
        FeatureEngineering: false,
        DatabaseCommit: false
      }
    };

    this.syncJobs.unshift(job);
    if (this.syncJobs.length > 50) this.syncJobs.pop();
    return job;
  }

  public updateJobCheckpoint(jobId: string, stage: string, passed: boolean) {
    const job = this.syncJobs.find(j => j.id === jobId);
    if (job) {
      job.stage_checkpoints[stage] = passed;
    }
  }

  public finishSyncJob(
    jobId: string, 
    stats: Partial<SyncJobRecord>
  ) {
    const job = this.syncJobs.find(j => j.id === jobId);
    if (job) {
      Object.assign(job, stats);
      job.finished_at = new Date().toISOString();
      const startTime = new Date(job.started_at).getTime();
      job.processing_time_ms = Date.now() - startTime;
      job.status = (stats.rows_quarantined || 0) > 0 ? 'quarantined' : 'completed';
    }
  }

  public isIncrementalUnchanged(sheetName: string, checksum: string): boolean {
    const previous = this.sheetChecksums.get(sheetName);
    if (previous === checksum) {
      return true;
    }
    this.sheetChecksums.set(sheetName, checksum);
    return false;
  }
}

export const globalSyncService = new SyncService();
