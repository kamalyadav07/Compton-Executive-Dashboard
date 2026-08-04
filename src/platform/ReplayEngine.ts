import type { StageCheckpoint, PipelineStageKey } from './types';
import { globalSyncService } from './SyncService';
import { globalDLQService } from './DLQService';

export class ReplayEngine {
  private checkpoints: StageCheckpoint[] = [];

  public logCheckpoint(
    jobId: string,
    stage: PipelineStageKey,
    passed: boolean,
    recordsInStage: number,
    error?: string
  ): StageCheckpoint {
    const checkpoint: StageCheckpoint = {
      jobId,
      stage,
      passed,
      timestamp: new Date().toISOString(),
      recordsInStage,
      error
    };
    this.checkpoints.unshift(checkpoint);
    globalSyncService.updateJobCheckpoint(jobId, stage, passed);
    return checkpoint;
  }

  public getCheckpointsForJob(jobId: string): StageCheckpoint[] {
    return this.checkpoints.filter(c => c.jobId === jobId);
  }

  public getFailedCheckpoints(): StageCheckpoint[] {
    return this.checkpoints.filter(c => !c.passed);
  }

  // Replay job from its last successful stage checkpoint
  public async replaySyncJob(
    jobId: string,
    reRunPipeline: (jobId: string, resumeFromStage: PipelineStageKey) => Promise<void>
  ): Promise<{ success: boolean; resumedFromStage: PipelineStageKey; message: string }> {
    const jobCheckpoints = this.getCheckpointsForJob(jobId);
    
    let resumeStage: PipelineStageKey = 'Validation';
    const stagesInOrder: PipelineStageKey[] = [
      'Validation',
      'Normalization',
      'Deduplication',
      'BusinessRules',
      'FeatureEngineering',
      'DatabaseCommit'
    ];

    // Find first failed or missing stage
    for (const stage of stagesInOrder) {
      const cp = jobCheckpoints.find(c => c.stage === stage);
      if (!cp || !cp.passed) {
        resumeStage = stage;
        break;
      }
    }

    try {
      await reRunPipeline(jobId, resumeStage);
      return {
        success: true,
        resumedFromStage: resumeStage,
        message: `Successfully replayed sync job ${jobId} resuming from stage '${resumeStage}'.`
      };
    } catch (err: any) {
      globalDLQService.pushToDLQ(jobId, resumeStage, { jobId }, err.message || 'Replay failure');
      return {
        success: false,
        resumedFromStage: resumeStage,
        message: `Replay failed at stage '${resumeStage}': ${err.message}`
      };
    }
  }
}

export const globalReplayEngine = new ReplayEngine();
