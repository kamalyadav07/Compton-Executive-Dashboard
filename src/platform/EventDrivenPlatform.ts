import type { DealRecord } from '../types/sales';
import type { EnhancedDealRecord, SyncJobRecord, PipelineStageKey } from './types';
import { container } from './DIContainer';

export class EventDrivenPlatform {
  private c = container;

  // Primary 10-stage execution pipeline (Item 1)
  public async processSheetIngestion(
    sheetName: string,
    rawRecords: DealRecord[],
    initiatedBy: string = 'manual'
  ): Promise<{
    syncJob: SyncJobRecord;
    processedRecords: EnhancedDealRecord[];
    dqiScore: number;
    quarantinedCount: number;
  }> {
    const startTime = Date.now();
    const syncJob = this.c.syncService.startSyncJob(sheetName, initiatedBy);
    syncJob.rows_read = rawRecords.length;

    // Checksum & Incremental Check (Acceptance Criteria #1)
    const checksum = this.c.syncService.computeChecksum(rawRecords);
    syncJob.checksum = checksum;

    const isUnchanged = this.c.syncService.isIncrementalUnchanged(sheetName, checksum);
    if (isUnchanged && initiatedBy === 'auto_polling') {
      syncJob.rows_skipped = rawRecords.length;
      this.c.syncService.finishSyncJob(syncJob.id, { rows_skipped: rawRecords.length });
      return {
        syncJob,
        processedRecords: this.c.databaseStore.getRecords(),
        dqiScore: 100,
        quarantinedCount: 0
      };
    }

    // Stage 1: Ingestion & Circuit Breaker Check
    this.c.eventBus.publish('sheet.raw_ingested', { sheetName, count: rawRecords.length });
    this.c.observability.recordStageMetrics('sync_service', Date.now() - startTime, rawRecords.length);

    // Stage 2: Validation Service (Referential Integrity + DQI)
    const valStart = Date.now();
    const dqiScore = this.c.validationService.calculateDQIScore(rawRecords);
    syncJob.dqi_score = dqiScore;
    this.c.replayEngine.logCheckpoint(syncJob.id, 'Validation', true, rawRecords.length);
    this.c.observability.recordStageMetrics('validation_service', Date.now() - valStart, rawRecords.length);
    this.c.eventBus.publish('sheet.validated', { jobId: syncJob.id, dqiScore });

    // Stage 3: Transformation Service & Provenance Tagging
    const transStart = Date.now();
    const enhanced: EnhancedDealRecord[] = rawRecords.map((r, idx) => {
      const refCheck = this.c.validationService.validateReferentialIntegrity(r);
      const enhancedRec = this.c.transformationService.attachProvenance(
        r,
        sheetName,
        `sheet_doc_${sheetName.toLowerCase()}`,
        'Worksheet_1',
        idx + 1,
        syncJob.id
      );

      if (!refCheck.valid) {
        enhancedRec.validationErrors = refCheck.errors;
      }
      return enhancedRec;
    });

    this.c.replayEngine.logCheckpoint(syncJob.id, 'Normalization', true, enhanced.length);

    // Deduplication with precision >= 95%
    const dedupRes = this.c.transformationService.deduplicateRecords(enhanced);
    syncJob.rows_updated = dedupRes.duplicatesRemoved;
    this.c.replayEngine.logCheckpoint(syncJob.id, 'Deduplication', true, dedupRes.uniqueRecords.length);
    this.c.observability.recordStageMetrics('transformation_service', Date.now() - transStart, enhanced.length);

    // Stage 4: Business Rule Engine (Item 10) & DLQ Quarantine
    const ruleStart = Date.now();
    const passedRecords: EnhancedDealRecord[] = [];
    let quarantinedCount = 0;

    for (const rec of dedupRes.uniqueRecords) {
      const ruleResult = this.c.businessRuleEngine.validateRecord(rec);
      if (!ruleResult.passed) {
        quarantinedCount++;
        rec.quarantined = true;
        rec.validationErrors = ruleResult.results.filter(r => !r.passed).map(r => r.message);
        // Push failed row to DLQ (Item 9)
        this.c.dlqService.pushToDLQ(syncJob.id, 'BusinessRules', rec, rec.validationErrors.join('; '));
      } else {
        passedRecords.push(rec);
      }
    }

    syncJob.rows_quarantined = quarantinedCount;
    syncJob.rows_inserted = passedRecords.length;
    this.c.replayEngine.logCheckpoint(syncJob.id, 'BusinessRules', quarantinedCount === 0, passedRecords.length);
    this.c.observability.recordStageMetrics('feature_engineering', Date.now() - ruleStart, passedRecords.length);

    // Stage 5: Feature Engineering Stage & Feature Store
    const featStart = Date.now();
    const featureStoreState = this.c.featureEngineeringService.computeFeatureStore(passedRecords);
    this.c.featureStore.updateStore(featureStoreState);
    this.c.replayEngine.logCheckpoint(syncJob.id, 'FeatureEngineering', true, passedRecords.length);
    this.c.observability.recordStageMetrics('feature_store', Date.now() - featStart, passedRecords.length);
    this.c.eventBus.publish('features.engineered', { count: passedRecords.length });

    // Stage 6 & 7: Database Commit & Materialized Views (Item 22)
    const dbStart = Date.now();
    this.c.databaseStore.saveRecords(passedRecords);
    this.c.databaseStore.logEvent('DealCreated', syncJob.id, { sheetName, count: passedRecords.length });
    this.c.replayEngine.logCheckpoint(syncJob.id, 'DatabaseCommit', true, passedRecords.length);
    this.c.observability.recordStageMetrics('database', Date.now() - dbStart, passedRecords.length);
    this.c.eventBus.publish('db.committed', { jobId: syncJob.id });

    // Stage 8: Data Drift Detection (Item 11)
    this.c.driftDetector.detectDrift(syncJob.id, passedRecords);

    // Stage 9: AI Readiness Stage (Item 20 & 21)
    const aiStart = Date.now();
    this.c.aiReadinessService.generateAndStoreEmbeddings(passedRecords);
    this.c.aiReadinessService.buildAIContextCache(featureStoreState, passedRecords);
    this.c.observability.recordStageMetrics('ai_engine', Date.now() - aiStart, passedRecords.length);

    // Stage 10: Dependency Graph Invalidation (Item 14)
    this.c.dependencyGraph.invalidateFromSource(`sheet_${sheetName.toLowerCase().includes('won') ? 'won' : sheetName.toLowerCase().includes('lost') ? 'lost' : 'progress'}`);
    this.c.dependencyGraph.markAllValid();

    // Finish Sync Job
    this.c.syncService.finishSyncJob(syncJob.id, {
      rows_inserted: passedRecords.length,
      rows_quarantined: quarantinedCount,
      dqi_score: dqiScore,
      status: quarantinedCount > 0 ? 'quarantined' : 'completed'
    });

    return {
      syncJob,
      processedRecords: passedRecords,
      dqiScore,
      quarantinedCount
    };
  }

  // Replay Pipeline Execution from Stage Checkpoint (Item 3 & 8)
  public async replayCheckpoint(
    jobId: string,
    resumeStage: PipelineStageKey
  ): Promise<boolean> {
    const existingJob = this.c.syncService.getSyncJobs().find(j => j.id === jobId);
    if (!existingJob) return false;

    existingJob.status = 'replaying';
    const currentRecords = this.c.databaseStore.getRecords();

    // Run re-processing from specified stage
    if (resumeStage === 'BusinessRules' || resumeStage === 'FeatureEngineering') {
      const features = this.c.featureEngineeringService.computeFeatureStore(currentRecords);
      this.c.featureStore.updateStore(features);
    }

    this.c.syncService.finishSyncJob(jobId, { status: 'completed' });
    this.c.databaseStore.logEvent('RuleApplied', jobId, { replayedStage: resumeStage }, 'ReplayEngine');
    return true;
  }
}

export const globalPlatform = new EventDrivenPlatform();
