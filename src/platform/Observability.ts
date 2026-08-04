import type { PlatformStageName, StageObservabilityMetrics } from './types';

export class ObservabilityService {
  private stageMetrics: Record<PlatformStageName, StageObservabilityMetrics> = {
    sync_service: { stage: 'sync_service', latencyMs: 240, cpuPct: 4.2, memoryMb: 42, rowsPerSec: 120, errorPct: 0, retryCount: 0, queueTimeMs: 12 },
    event_bus: { stage: 'event_bus', latencyMs: 15, cpuPct: 1.1, memoryMb: 12, rowsPerSec: 450, errorPct: 0, retryCount: 0, queueTimeMs: 2 },
    validation_service: { stage: 'validation_service', latencyMs: 85, cpuPct: 3.5, memoryMb: 28, rowsPerSec: 280, errorPct: 0.5, retryCount: 0, queueTimeMs: 5 },
    transformation_service: { stage: 'transformation_service', latencyMs: 110, cpuPct: 5.2, memoryMb: 34, rowsPerSec: 220, errorPct: 0, retryCount: 0, queueTimeMs: 8 },
    feature_engineering: { stage: 'feature_engineering', latencyMs: 145, cpuPct: 6.8, memoryMb: 48, rowsPerSec: 180, errorPct: 0, retryCount: 0, queueTimeMs: 10 },
    database: { stage: 'database', latencyMs: 95, cpuPct: 4.1, memoryMb: 52, rowsPerSec: 310, errorPct: 0, retryCount: 0, queueTimeMs: 6 },
    materialized_views: { stage: 'materialized_views', latencyMs: 65, cpuPct: 3.2, memoryMb: 38, rowsPerSec: 400, errorPct: 0, retryCount: 0, queueTimeMs: 4 },
    feature_store: { stage: 'feature_store', latencyMs: 30, cpuPct: 2.1, memoryMb: 22, rowsPerSec: 600, errorPct: 0, retryCount: 0, queueTimeMs: 2 },
    ai_engine: { stage: 'ai_engine', latencyMs: 180, cpuPct: 7.4, memoryMb: 64, rowsPerSec: 90, errorPct: 0, retryCount: 0, queueTimeMs: 15 },
    dashboard: { stage: 'dashboard', latencyMs: 45, cpuPct: 2.8, memoryMb: 30, rowsPerSec: 500, errorPct: 0, retryCount: 0, queueTimeMs: 3 }
  };

  public recordStageMetrics(
    stage: PlatformStageName,
    latencyMs: number,
    rowsProcessed: number,
    errorPct = 0,
    retries = 0
  ) {
    const rowsSec = latencyMs > 0 ? Math.round((rowsProcessed / (latencyMs / 1000))) : 300;

    this.stageMetrics[stage] = {
      stage,
      latencyMs,
      cpuPct: Number((Math.random() * 5 + 2).toFixed(1)),
      memoryMb: Math.round(Math.random() * 20 + 30),
      rowsPerSec: Math.min(1000, Math.max(10, rowsSec)),
      errorPct,
      retryCount: retries,
      queueTimeMs: Math.round(Math.random() * 10 + 2)
    };
  }

  public getMetrics(): Record<PlatformStageName, StageObservabilityMetrics> {
    return this.stageMetrics;
  }

  // Item 19: Prometheus / Metrics exporter generator
  public generatePrometheusMetrics(dqiScore: number, queueLength: number): string {
    const lines: string[] = [
      '# HELP data_platform_rows_per_sec Rows processed per second by stage',
      '# TYPE data_platform_rows_per_sec gauge'
    ];

    Object.values(this.stageMetrics).forEach(m => {
      lines.push(`data_platform_rows_per_sec{stage="${m.stage}"} ${m.rowsPerSec}`);
    });

    lines.push(
      '',
      '# HELP data_platform_latency_ms Stage execution latency in milliseconds',
      '# TYPE data_platform_latency_ms gauge'
    );
    Object.values(this.stageMetrics).forEach(m => {
      lines.push(`data_platform_latency_ms{stage="${m.stage}"} ${m.latencyMs}`);
    });

    lines.push(
      '',
      '# HELP data_platform_dqi_score Current overall Data Quality Index',
      '# TYPE data_platform_dqi_score gauge',
      `data_platform_dqi_score ${dqiScore}`,
      '',
      '# HELP data_platform_dlq_queue_length Number of items in Dead Letter Queue',
      '# TYPE data_platform_dlq_queue_length gauge',
      `data_platform_dlq_queue_length ${queueLength}`,
      '',
      '# HELP data_platform_memory_mb Estimated memory consumption in MB',
      '# TYPE data_platform_memory_mb gauge',
      `data_platform_memory_mb ${Object.values(this.stageMetrics).reduce((sum, m) => sum + m.memoryMb, 0)}`
    );

    return lines.join('\n');
  }
}

export const globalObservability = new ObservabilityService();
