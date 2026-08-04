import { globalSyncService, SyncService } from './SyncService';
import { globalEventBus, EventBus } from './EventBus';
import { globalValidationService, ValidationService } from './ValidationService';
import { globalTransformationService, TransformationService } from './TransformationService';
import { globalFeatureEngineeringService, FeatureEngineeringService } from './FeatureEngineeringService';
import { globalFeatureStore, FeatureStore } from './FeatureStore';
import { globalDatabaseStore, DatabaseStore } from './DatabaseStore';
import { globalDLQService, DLQService } from './DLQService';
import { globalReplayEngine, ReplayEngine } from './ReplayEngine';
import { globalBusinessRuleEngine, BusinessRuleEngine } from './BusinessRuleEngine';
import { globalDriftDetector, DriftDetector } from './DriftDetector';
import { globalDependencyGraph, DependencyGraph } from './DependencyGraph';
import { globalObservability, ObservabilityService } from './Observability';
import { globalAIReadinessService, AIReadinessService } from './AIReadiness';

export interface IDIPlatformContainer {
  syncService: SyncService;
  eventBus: EventBus;
  validationService: ValidationService;
  transformationService: TransformationService;
  featureEngineeringService: FeatureEngineeringService;
  featureStore: FeatureStore;
  databaseStore: DatabaseStore;
  dlqService: DLQService;
  replayEngine: ReplayEngine;
  businessRuleEngine: BusinessRuleEngine;
  driftDetector: DriftDetector;
  dependencyGraph: DependencyGraph;
  observability: ObservabilityService;
  aiReadinessService: AIReadinessService;
}

export class DIContainer implements IDIPlatformContainer {
  public syncService = globalSyncService;
  public eventBus = globalEventBus;
  public validationService = globalValidationService;
  public transformationService = globalTransformationService;
  public featureEngineeringService = globalFeatureEngineeringService;
  public featureStore = globalFeatureStore;
  public databaseStore = globalDatabaseStore;
  public dlqService = globalDLQService;
  public replayEngine = globalReplayEngine;
  public businessRuleEngine = globalBusinessRuleEngine;
  public driftDetector = globalDriftDetector;
  public dependencyGraph = globalDependencyGraph;
  public observability = globalObservability;
  public aiReadinessService = globalAIReadinessService;
}

export const container = new DIContainer();
