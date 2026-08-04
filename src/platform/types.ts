import type { DealRecord } from '../types/sales';

// 1. Architecture Stage Names
export type PlatformStageName = 
  | 'sync_service'
  | 'event_bus'
  | 'validation_service'
  | 'transformation_service'
  | 'feature_engineering'
  | 'database'
  | 'materialized_views'
  | 'feature_store'
  | 'ai_engine'
  | 'dashboard';

// 2. Sync Job Metadata Table (sync_jobs)
export interface SyncJobRecord {
  id: string;
  started_at: string;
  finished_at?: string;
  status: 'running' | 'completed' | 'failed' | 'replaying' | 'quarantined';
  sheet_name: string;
  rows_read: number;
  rows_inserted: number;
  rows_updated: number;
  rows_deleted: number;
  rows_skipped: number;
  rows_quarantined: number;
  processing_time_ms: number;
  retry_count: number;
  initiated_by: string; // 'auto_polling' | 'manual' | 'replay_engine'
  sync_version: string;
  checksum: string;
  dqi_score: number; // Data Quality Index (0 - 100)
  stage_checkpoints: Record<string, boolean>;
  error_message?: string;
}

// 6 & 7. Data Lineage & Provenance
export interface DataProvenance {
  source: 'Google Sheet' | 'File Upload' | 'Replay Engine';
  sheetName: string;
  sheetId: string;
  worksheet: string;
  rowNumber: number;
  syncJobId: string;
  rowHash: string;
  ingestedAt: string;
}

export interface EnhancedDealRecord extends DealRecord {
  provenance: DataProvenance;
  dqiScore: number;
  validationErrors?: string[];
  quarantined?: boolean;
}

export interface KPILineageTrace {
  kpiId: string;
  kpiName: string;
  currentValue: string | number;
  materializedView: string;
  formula: string;
  transformationStage: string;
  sourceRowIds: string[];
  sheetSources: string[];
  lastUpdated: string;
}

// 8. Checkpointing
export type PipelineStageKey = 
  | 'Validation'
  | 'Normalization'
  | 'Deduplication'
  | 'BusinessRules'
  | 'FeatureEngineering'
  | 'DatabaseCommit';

export interface StageCheckpoint {
  jobId: string;
  stage: PipelineStageKey;
  passed: boolean;
  timestamp: string;
  recordsInStage: number;
  error?: string;
}

// 9. Dead Letter Queue (DLQ)
export interface DLQRecord {
  id: string;
  syncJobId: string;
  stageName: string;
  rawPayload: any;
  reason: string;
  quarantinedAt: string;
  status: 'pending_review' | 'retried' | 'discarded' | 'resolved';
  reviewedBy?: string;
  notes?: string;
}

// 10 & 23. Business Rule Engine & Rule Versioning
export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  dealType?: 'won' | 'lost' | 'in_progress' | 'all';
  targetField: string;
  condition: 'required' | 'positive_number' | 'custom_expr' | 'valid_ref';
  customExpr?: string;
  version: string; // e.g. "v3.2"
  author: string;
  createdAt: string;
  isActive: boolean;
}

export interface RuleValidationResult {
  passed: boolean;
  ruleId: string;
  ruleVersion: string;
  message: string;
  field: string;
}

// 11. Data Drift Alert
export interface DriftAlert {
  id: string;
  metricName: string;
  previousValue: number;
  currentValue: number;
  changePct: number;
  thresholdPct: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: string;
  syncJobId: string;
  description: string;
}

// 13. Event Sourcing Log
export interface DataPlatformEvent {
  id: string;
  timestamp: string;
  entityId: string;
  eventType: 'DealCreated' | 'ProposalUploaded' | 'RevenueChanged' | 'StageChanged' | 'DealWon' | 'DealLost' | 'RuleApplied';
  actor: string;
  payload: Record<string, any>;
  previousState?: Record<string, any>;
}

// 14. Dependency Graph Node
export interface DependencyNode {
  id: string;
  label: string;
  type: 'source' | 'view' | 'kpi' | 'chart' | 'ai';
  dependencies: string[];
  lastInvalidatedAt?: string;
  status: 'valid' | 'stale' | 'updating';
}

// 15 & 19. Observability & Metrics
export interface StageObservabilityMetrics {
  stage: PlatformStageName;
  latencyMs: number;
  cpuPct: number;
  memoryMb: number;
  rowsPerSec: number;
  errorPct: number;
  retryCount: number;
  queueTimeMs: number;
}

// 4 & 5. Feature Store & Feature Engineering
export interface CustomerFeature {
  customerId: string;
  customerName: string;
  totalWonDeals: number;
  totalLifetimeRevenue: number;
  avgDealSize: number;
  daysSinceLastPurchase: number;
  rolling90DayRevenue: number;
  healthScore: number; // 0 - 100
  industry: string;
  lastPurchaseDate: string;
}

export interface DealFeature {
  dealId: string;
  customer: string;
  dealSize: number;
  closingTimeDays: number;
  winProbability: number;
  marginPct: number;
  salesperson: string;
  industry: string;
}

export interface SalespersonFeature {
  salesRep: string;
  totalWonRevenue: number;
  wonCount: number;
  lostCount: number;
  winRatePct: number;
  avgClosingTimeDays: number;
  avgDealSize: number;
  rolling90DayRevenue: number;
}

export interface IndustryFeature {
  industry: string;
  totalRevenue: number;
  dealCount: number;
  winRatePct: number;
  avgDealSize: number;
}

export interface FeatureStoreState {
  customerFeatures: Record<string, CustomerFeature>;
  dealFeatures: Record<string, DealFeature>;
  salespersonFeatures: Record<string, SalespersonFeature>;
  industryFeatures: Record<string, IndustryFeature>;
  lastUpdated: string;
}

// 21. Vector Embedding & Vector Store
export interface VectorDocument {
  id: string;
  type: 'proposal' | 'bom' | 'meeting_notes' | 'customer_summary';
  entityId: string;
  title: string;
  textSnippet: string;
  embedding: number[]; // e.g. 64-dim representation
  metadata: Record<string, any>;
  createdAt: string;
}

// 24. Semantic Layer Objects
export interface SemanticObject {
  name: string;
  description: string;
  type: 'metric' | 'dimension' | 'hierarchy';
  formula?: string;
  sampleQuery: string;
  getSummary: (features: FeatureStoreState, records: EnhancedDealRecord[]) => any;
}
