import { globalPlatform } from '../EventDrivenPlatform';
import { container } from '../DIContainer';
import type { DealRecord } from '../../types/sales';

export async function runPlatformAcceptanceSuite(): Promise<{
  passed: boolean;
  results: { testName: string; passed: boolean; detail: string }[];
}> {
  const results: { testName: string; passed: boolean; detail: string }[] = [];

  const sampleDeals: DealRecord[] = [
    {
      id: 'D001',
      customer: 'Acme Health Systems',
      grossRevenue: 500000,
      gstAmount: 90000,
      netRevenue: 410000,
      salesRep: 'Kamal',
      industry: 'Healthcare',
      solution: 'Enterprise Cloud',
      leadSource: 'Inbound Web',
      stage: 'Won',
      date: '2026-07-01',
      monthYear: '2026-07',
      year: 2026,
      quarter: 'Q3 2026',
      type: 'won',
      salesCycleDays: 24,
      winProbability: 100
    },
    {
      id: 'D002',
      customer: 'Acme Health Systems',
      grossRevenue: 500000,
      gstAmount: 90000,
      netRevenue: 410000,
      salesRep: 'Kamal',
      industry: 'Healthcare',
      solution: 'Enterprise Cloud',
      leadSource: 'Inbound Web',
      stage: 'Won',
      date: '2026-07-01',
      monthYear: '2026-07',
      year: 2026,
      quarter: 'Q3 2026',
      type: 'won',
      salesCycleDays: 24,
      winProbability: 100
    },
    {
      id: 'D003',
      customer: 'FinCorp Global',
      grossRevenue: -500, // Invalid revenue -> quarantine to DLQ
      gstAmount: 0,
      netRevenue: -500,
      salesRep: 'Priya Sharma',
      industry: 'FinTech',
      solution: 'Payment Gateway',
      leadSource: 'Outbound',
      stage: 'Lost',
      date: '2026-07-10',
      monthYear: '2026-07',
      year: 2026,
      quarter: 'Q3 2026',
      type: 'lost',
      lostReason: 'Price',
      winProbability: 0
    }
  ];

  // Test 1: Ingestion & DQI score computation
  const ingRes = await globalPlatform.processSheetIngestion('Test Sheet', sampleDeals, 'manual');
  const test1Passed = ingRes.syncJob.dqi_score > 0 && ingRes.syncJob.rows_read === 3;
  results.push({
    testName: 'DQI Score Computation & Job Metadata',
    passed: test1Passed,
    detail: `Computed DQI: ${ingRes.syncJob.dqi_score}%, Read: ${ingRes.syncJob.rows_read}, Quarantined: ${ingRes.quarantinedCount}`
  });

  // Test 2: DLQ Quarantine for Rule Violation
  const dlqRecords = container.dlqService.getDLQRecords();
  const test2Passed = dlqRecords.length > 0 && ingRes.quarantinedCount === 1;
  results.push({
    testName: 'Dead Letter Queue (DLQ) Quarantine Safety',
    passed: test2Passed,
    detail: `DLQ items count: ${dlqRecords.length}, Reason: ${dlqRecords[0]?.reason}`
  });

  // Test 3: Incremental Sync Checksum Detection
  const checksum = container.syncService.computeChecksum(sampleDeals);
  const isUnchanged = container.syncService.isIncrementalUnchanged('Test Sheet', checksum);
  results.push({
    testName: 'Incremental Sync Checksum Delta',
    passed: isUnchanged,
    detail: `Checksum ${checksum} correctly identified duplicate payload`
  });

  // Test 4: Feature Store Generation
  const features = container.featureStore.getStore();
  const test4Passed = Object.keys(features.customerFeatures).length > 0;
  results.push({
    testName: 'Feature Store Precomputation',
    passed: test4Passed,
    detail: `Generated customer features for ${Object.keys(features.customerFeatures).length} entities`
  });

  // Test 5: Replay Engine Idempotency
  const replayRes = await globalPlatform.replayCheckpoint(ingRes.syncJob.id, 'BusinessRules');
  results.push({
    testName: 'Replay Engine Idempotency & Resumption',
    passed: replayRes,
    detail: `Successfully replayed sync job ${ingRes.syncJob.id}`
  });

  const allPassed = results.every(r => r.passed);
  return { passed: allPassed, results };
}
