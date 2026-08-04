import type { DLQRecord } from './types';

export class DLQService {
  private dlqRecords: DLQRecord[] = [];

  public pushToDLQ(
    syncJobId: string,
    stageName: string,
    rawPayload: any,
    reason: string
  ): DLQRecord {
    const record: DLQRecord = {
      id: `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      syncJobId,
      stageName,
      rawPayload,
      reason,
      quarantinedAt: new Date().toISOString(),
      status: 'pending_review'
    };

    this.dlqRecords.unshift(record);
    if (this.dlqRecords.length > 200) this.dlqRecords.pop();
    return record;
  }

  public getDLQRecords(): DLQRecord[] {
    return [...this.dlqRecords];
  }

  public updateRecordStatus(
    id: string,
    status: DLQRecord['status'],
    reviewedBy = 'Admin User',
    notes?: string
  ): boolean {
    const rec = this.dlqRecords.find(r => r.id === id);
    if (rec) {
      rec.status = status;
      rec.reviewedBy = reviewedBy;
      rec.notes = notes;
      return true;
    }
    return false;
  }

  public clearDLQ() {
    this.dlqRecords = [];
  }
}

export const globalDLQService = new DLQService();
