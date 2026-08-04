import React, { useState } from 'react';
import { 
  Activity, 
  Layers, 
  Database, 
  ShieldAlert, 
  Terminal, 
  Cpu, 
  RotateCcw, 
  GitCommit, 
  CheckCircle2, 
  AlertTriangle, 
  X,
  FileCode,
  Zap,
  Sparkles
} from 'lucide-react';
import { container } from '../../platform/DIContainer';

interface PlatformControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

export const PlatformControlCenter: React.FC<PlatformControlCenterProps> = ({
  isOpen,
  onClose,
  onRefreshData
}) => {
  const [activeTab, setActiveTab] = useState<
    'pipeline' | 'sync_jobs' | 'lineage' | 'feature_store' | 'rules' | 'dlq' | 'drift' | 'observability' | 'ai_readiness'
  >('pipeline');

  const c = container;

  if (!isOpen) return null;

  const syncJobs = c.syncService.getSyncJobs();
  const dlqRecords = c.dlqService.getDLQRecords();
  const driftAlerts = c.driftDetector.getAlerts();
  const rules = c.businessRuleEngine.getRules();
  const featureState = c.featureStore.getStore();
  const circuitState = c.syncService.getCircuitState();
  const stageMetrics = c.observability.getMetrics();
  const aiCache = c.aiReadinessService.getAIContextCache();
  const semanticObjects = c.aiReadinessService.getSemanticObjects();

  // Replay job action
  const handleReplayJob = async (jobId: string) => {
    await c.replayEngine.replaySyncJob(jobId, async (jId) => {
      await c.replayEngine.replaySyncJob(jId, async () => {
        // Mock replay
      });
    });
    if (onRefreshData) onRefreshData();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-lg p-3 md:p-6 overflow-hidden animate-fade-in">
      <div className="glass-panel w-full max-w-7xl h-[92vh] rounded-3xl border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden bg-slate-950/95">
        
        {/* Top Navigation Bar */}
        <div className="px-6 py-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Zap className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-slate-100 tracking-tight">
                  Event-Driven Data Platform Control Center
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                  v3.2.0 Active
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border rounded-md ${
                  circuitState === 'CLOSED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  Circuit: {circuitState}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoring 10 decoupled micro-service stages, Feature Store, Lineage, Replay Engine & AI Context
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Ribbon */}
        <div className="px-6 py-2.5 bg-slate-900/50 border-b border-slate-800/80 flex items-center space-x-1 overflow-x-auto shrink-0 scrollbar-none text-xs font-bold">
          <TabButton
            active={activeTab === 'pipeline'}
            icon={<Layers className="w-3.5 h-3.5" />}
            label="1. Platform Architecture (10 Stages)"
            onClick={() => setActiveTab('pipeline')}
          />
          <TabButton
            active={activeTab === 'sync_jobs'}
            icon={<Activity className="w-3.5 h-3.5 text-cyan-400" />}
            label={`2. Sync Jobs (${syncJobs.length})`}
            onClick={() => setActiveTab('sync_jobs')}
          />
          <TabButton
            active={activeTab === 'lineage'}
            icon={<GitCommit className="w-3.5 h-3.5 text-amber-400" />}
            label="3. Lineage & Provenance"
            onClick={() => setActiveTab('lineage')}
          />
          <TabButton
            active={activeTab === 'feature_store'}
            icon={<Database className="w-3.5 h-3.5 text-purple-400" />}
            label="4. Feature Store"
            onClick={() => setActiveTab('feature_store')}
          />
          <TabButton
            active={activeTab === 'rules'}
            icon={<ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />}
            label={`5. Rule Engine (${rules.length})`}
            onClick={() => setActiveTab('rules')}
          />
          <TabButton
            active={activeTab === 'dlq'}
            icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
            label={`6. DLQ (${dlqRecords.length})`}
            onClick={() => setActiveTab('dlq')}
            badgeCount={dlqRecords.filter(d => d.status === 'pending_review').length}
          />
          <TabButton
            active={activeTab === 'drift'}
            icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
            label={`7. Data Drift (${driftAlerts.length})`}
            onClick={() => setActiveTab('drift')}
          />
          <TabButton
            active={activeTab === 'observability'}
            icon={<Cpu className="w-3.5 h-3.5 text-cyan-400" />}
            label="8. Observability & /metrics"
            onClick={() => setActiveTab('observability')}
          />
          <TabButton
            active={activeTab === 'ai_readiness'}
            icon={<Sparkles className="w-3.5 h-3.5 text-pink-400" />}
            label="9. AI Readiness & Semantic Layer"
            onClick={() => setActiveTab('ai_readiness')}
          />
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-200">
          
          {/* TAB 1: Platform Architecture (10 Stages Flow Visualizer) */}
          {activeTab === 'pipeline' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">10-Stage Decoupled Platform Architecture</h3>
                  <p className="text-xs text-slate-400">Google Sheets → Sync Service → Event Bus → Validation → Transformation → Feature Eng → DB → Views → Feature Store → AI Engine → Dashboard</p>
                </div>
                <span className="text-xs text-emerald-400 font-mono font-bold bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                  Event Bus Subscriptions: Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                <StageCard
                  step={1}
                  title="Google Sheets"
                  sub="Raw Data Ingestion"
                  status="Active"
                  latency={`${stageMetrics.sync_service?.latencyMs || 240}ms`}
                  rowsSec={`${stageMetrics.sync_service?.rowsPerSec || 120} rows/s`}
                  accent="blue"
                />
                <StageCard
                  step={2}
                  title="Sync Service"
                  sub="Circuit & Backoff"
                  status="CLOSED"
                  latency={`${stageMetrics.sync_service?.latencyMs || 240}ms`}
                  rowsSec="Retries: 0"
                  accent="cyan"
                />
                <StageCard
                  step={3}
                  title="Event Bus"
                  sub="Pub/Sub Broker"
                  status="Publishing"
                  latency={`${stageMetrics.event_bus?.latencyMs || 15}ms`}
                  rowsSec={`${stageMetrics.event_bus?.rowsPerSec || 450} rows/s`}
                  accent="indigo"
                />
                <StageCard
                  step={4}
                  title="Validation Service"
                  sub="DQI & Master Ref"
                  status="Passing"
                  latency={`${stageMetrics.validation_service?.latencyMs || 85}ms`}
                  rowsSec="DQI: 100%"
                  accent="emerald"
                />
                <StageCard
                  step={5}
                  title="Transformation"
                  sub="Provenance & Dedup"
                  status="Tagged"
                  latency={`${stageMetrics.transformation_service?.latencyMs || 110}ms`}
                  rowsSec="Precision ≥95%"
                  accent="amber"
                />
                <StageCard
                  step={6}
                  title="Feature Engineering"
                  sub="Rolling & Recency"
                  status="Computed"
                  latency={`${stageMetrics.feature_engineering?.latencyMs || 145}ms`}
                  rowsSec="9 Metrics"
                  accent="purple"
                />
                <StageCard
                  step={7}
                  title="Database Commit"
                  sub="Checkpoint & Events"
                  status="Committed"
                  latency={`${stageMetrics.database?.latencyMs || 95}ms`}
                  rowsSec="ACID State"
                  accent="emerald"
                />
                <StageCard
                  step={8}
                  title="Materialized Views"
                  sub="6 Precomputed Views"
                  status="Refreshed"
                  latency={`${stageMetrics.materialized_views?.latencyMs || 65}ms`}
                  rowsSec="Selective DAG"
                  accent="blue"
                />
                <StageCard
                  step={9}
                  title="Feature Store"
                  sub="Fast In-Memory"
                  status="Ready"
                  latency={`${stageMetrics.feature_store?.latencyMs || 30}ms`}
                  rowsSec="4 Entities"
                  accent="pink"
                />
                <StageCard
                  step={10}
                  title="AI Engine & Dashboard"
                  sub="RAG & Live Charts"
                  status="Streaming"
                  latency={`${stageMetrics.ai_engine?.latencyMs || 180}ms`}
                  rowsSec="Refreshed <5s"
                  accent="cyan"
                />
              </div>

              {/* Event Sourcing Log */}
              <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-extrabold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    Event Sourcing Timeline Log (Item 13)
                  </h4>
                  <span className="text-[10px] text-slate-500">Query: "What changed during the last 15 days?"</span>
                </div>
                <div className="font-mono text-[11px] space-y-1.5 max-h-48 overflow-y-auto pr-2">
                  {c.databaseStore.getEventHistory(15).map((evt, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="flex items-center space-x-3">
                        <span className="text-cyan-400 font-bold">[{evt.eventType}]</span>
                        <span className="text-slate-200">{evt.entityId}</span>
                        <span className="text-slate-500 text-[10px]">{JSON.stringify(evt.payload)}</span>
                      </div>
                      <span className="text-slate-500 text-[10px]">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Sync Jobs Metadata (sync_jobs) */}
          {activeTab === 'sync_jobs' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">sync_jobs Metadata Records (Item 2)</h3>
                  <p className="text-xs text-slate-400">Tracking execution times, DQI score, rows read/inserted/skipped/quarantined, and stage checkpoints</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold sticky top-0">
                    <tr>
                      <th className="p-3">Job ID</th>
                      <th className="p-3">Sheet Name</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">DQI Score</th>
                      <th className="p-3">Read / Ins / Quarantined</th>
                      <th className="p-3">Time (ms)</th>
                      <th className="p-3">Checksum</th>
                      <th className="p-3 text-right">Replay Engine</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {syncJobs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-500">No sync jobs executed yet. Trigger a sync to record metadata.</td>
                      </tr>
                    ) : (
                      syncJobs.map(job => (
                        <tr key={job.id} className="hover:bg-slate-900/50">
                          <td className="p-3 text-cyan-400 font-bold">{job.id}</td>
                          <td className="p-3 text-slate-200">{job.sheet_name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="font-extrabold text-emerald-400">{job.dqi_score}%</span>
                          </td>
                          <td className="p-3 text-slate-300">
                            {job.rows_read} / <span className="text-emerald-400">{job.rows_inserted}</span> / <span className="text-rose-400">{job.rows_quarantined}</span>
                          </td>
                          <td className="p-3 text-slate-400">{job.processing_time_ms} ms</td>
                          <td className="p-3 text-slate-500 text-[10px] truncate max-w-[120px]">{job.checksum}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleReplayJob(job.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-[11px] font-sans font-bold transition-all flex items-center gap-1.5 ml-auto"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Replay Job</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Data Lineage & Provenance */}
          {activeTab === 'lineage' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-100">Data Lineage & Provenance Traceability (Item 6 & 7)</h3>
                <p className="text-xs text-slate-400">Trace every KPI and deal value back to its exact Google Sheet, Worksheet, Row Number, Sync Job, and Row Hash.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* KPI Lineage Graph */}
                <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider">KPI Lineage Trace Example</h4>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">KPI: Total Monthly Revenue</span>
                      <span className="text-emerald-400 font-extrabold">₹48,50,000</span>
                    </div>
                    <div className="text-[11px] text-slate-400 space-y-1 font-mono pt-2 border-t border-slate-800">
                      <div>↓ Materialized View: <span className="text-blue-400">customerHealthView</span></div>
                      <div>↓ Formula: <span className="text-purple-400">SUM(GrossRevenue) - SUM(GST)</span></div>
                      <div>↓ Transformation: <span className="text-amber-400">Deduplication + Currency Cleaning</span></div>
                      <div>↓ Source: <span className="text-emerald-400">Google Sheet: Won Deals (SheetID: 1A2b3C...)</span></div>
                    </div>
                  </div>
                </div>

                {/* Data Provenance Sample Row */}
                <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider">Row-Level Provenance Metadata</h4>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono space-y-1.5 text-slate-300">
                    <div>Source: <span className="text-slate-100 font-bold">Google Sheet</span></div>
                    <div>Sheet Name: <span className="text-cyan-400">Won Deals Sheet</span></div>
                    <div>Worksheet: <span className="text-slate-100">Sheet1</span></div>
                    <div>Row Number: <span className="text-amber-400">#42</span></div>
                    <div>Sync Job ID: <span className="text-purple-400">{syncJobs[0]?.id || 'sync_1722588000'}</span></div>
                    <div>Row Hash: <span className="text-slate-400">hash_9a8f7e6d</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Feature Store */}
          {activeTab === 'feature_store' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-100">Feature Store (Item 4 & 5)</h3>
                <p className="text-xs text-slate-400">Precomputed entity features consumed directly by AI Engine and Dashboard without recalculation.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Features */}
                <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                  <h4 className="text-xs font-extrabold text-purple-400 uppercase tracking-wider mb-3">customer_features</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {Object.values(featureState.customerFeatures).slice(0, 10).map((c, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-200">{c.customerName}</div>
                          <div className="text-[10px] text-slate-400">Recency: {c.daysSinceLastPurchase} days | Rev: ₹{c.totalLifetimeRevenue.toLocaleString()}</div>
                        </div>
                        <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 font-extrabold text-[11px] border border-purple-500/30">
                          Health: {c.healthScore}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Salesperson Features */}
                <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                  <h4 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider mb-3">salesperson_features</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {Object.values(featureState.salespersonFeatures).map((s, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-200">{s.salesRep}</div>
                          <div className="text-[10px] text-slate-400">Avg Closing: {s.avgClosingTimeDays}d | Won Rev: ₹{s.totalWonRevenue.toLocaleString()}</div>
                        </div>
                        <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 font-extrabold text-[11px] border border-emerald-500/30">
                          Win Rate: {s.winRatePct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Rule Engine & Versioning */}
          {activeTab === 'rules' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">Business Rule Engine & Versioning (Item 10 & 23)</h3>
                  <p className="text-xs text-slate-400">Configurable business rules decoupled from code. Tagged with Rule Versioning (e.g. v3.2) and author audit log.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rules.map(rule => (
                  <div key={rule.id} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {rule.version}
                        </span>
                        <h4 className="text-xs font-bold text-slate-100">{rule.name}</h4>
                      </div>
                      <button
                        onClick={() => c.businessRuleEngine.toggleRule(rule.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          rule.isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {rule.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">{rule.description}</p>
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Target: <strong className="text-slate-300 font-mono">{rule.targetField}</strong></span>
                      <span>Author: <strong className="text-slate-300">{rule.author}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: DLQ & Quarantine */}
          {activeTab === 'dlq' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-100">Dead Letter Queue (DLQ) & Admin Review (Item 9)</h3>
                <p className="text-xs text-slate-400">Failed records are quarantined without crashing the pipeline. Review, edit, or replay DLQ records.</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold sticky top-0">
                    <tr>
                      <th className="p-3">DLQ ID</th>
                      <th className="p-3">Sync Job ID</th>
                      <th className="p-3">Stage</th>
                      <th className="p-3">Quarantine Reason</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {dlqRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-500">Dead Letter Queue is empty. No quarantined rows.</td>
                      </tr>
                    ) : (
                      dlqRecords.map(dlq => (
                        <tr key={dlq.id} className="hover:bg-slate-900/50">
                          <td className="p-3 text-rose-400 font-bold">{dlq.id}</td>
                          <td className="p-3 text-slate-400">{dlq.syncJobId}</td>
                          <td className="p-3 text-cyan-400">{dlq.stageName}</td>
                          <td className="p-3 text-amber-300 font-sans">{dlq.reason}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {dlq.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => c.dlqService.updateRecordStatus(dlq.id, 'resolved')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 text-[11px] font-sans font-bold transition-all ml-auto"
                            >
                              Resolve & Replay
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: Data Drift Alerts */}
          {activeTab === 'drift' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-100">Data Drift Detection (Item 11)</h3>
                <p className="text-xs text-slate-400">Monitoring real-time statistical anomalies (e.g., sudden 10x revenue jump or won deal volume drop).</p>
              </div>

              <div className="space-y-3">
                {driftAlerts.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/50 text-center text-xs text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <span>No data drift detected. Metric distributions are within normal baseline ranges.</span>
                  </div>
                ) : (
                  driftAlerts.map(alert => (
                    <div key={alert.id} className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-amber-100">{alert.metricName} Drift Alert</h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 border border-amber-500/40">
                            Severity: {alert.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-amber-300/90">{alert.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 8: Observability & Prometheus */}
          {activeTab === 'observability' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-100">Platform Observability & Prometheus Metrics (Item 15 & 19)</h3>
                <p className="text-xs text-slate-400">Stage telemetry metrics and Prometheus exporter format string (`/metrics`).</p>
              </div>

              <div className="glass-panel p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    Exposed /metrics Prometheus Endpoint Payload
                  </h4>
                  <button
                    onClick={() => navigator.clipboard.writeText(c.observability.generatePrometheusMetrics(100, dlqRecords.length))}
                    className="px-3 py-1 rounded-lg bg-blue-600/20 text-blue-400 text-xs font-bold border border-blue-500/30"
                  >
                    Copy /metrics
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-64">
                  {c.observability.generatePrometheusMetrics(100, dlqRecords.length)}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 9: AI Readiness & Semantic Layer */}
          {activeTab === 'ai_readiness' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-100">AI Readiness Stage & Semantic Layer (Item 20, 21, 24)</h3>
                <p className="text-xs text-slate-400">Vector Embeddings, RAG search over proposals & BOMs, AI Context Cache, and Semantic Objects.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AI Context Cache */}
                <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-extrabold text-pink-400 uppercase tracking-wider">AI Context Cache (Precomputed)</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-mono p-3 rounded-xl bg-slate-900 border border-slate-800">
                    {aiCache?.summary || 'AI Context Cache is warmed and ready for Gemini queries.'}
                  </p>
                </div>

                {/* Semantic Layer Objects */}
                <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider">Semantic Layer Objects (Item 24)</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
                    {semanticObjects.map((obj, i) => (
                      <div key={i} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-100">{obj.name}</span>
                          <span className="text-[10px] text-slate-400 ml-2">({obj.type})</span>
                        </div>
                        <span className="text-[10px] text-cyan-400 font-mono">{obj.sampleQuery}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

interface TabButtonProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badgeCount?: number;
}

const TabButton: React.FC<TabButtonProps> = ({ active, icon, label, onClick, badgeCount }) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 rounded-xl flex items-center space-x-2 transition-all shrink-0 ${
      active
        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
    }`}
  >
    {icon}
    <span>{label}</span>
    {typeof badgeCount === 'number' && badgeCount > 0 && (
      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500 text-white">
        {badgeCount}
      </span>
    )}
  </button>
);

interface StageCardProps {
  step: number;
  title: string;
  sub: string;
  status: string;
  latency: string;
  rowsSec: string;
  accent: 'blue' | 'cyan' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'pink';
}

const StageCard: React.FC<StageCardProps> = ({ step, title, sub, status, latency, rowsSec }) => (
  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 hover:border-slate-700 transition-all">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-black text-slate-500">STAGE 0{step}</span>
      <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        {status}
      </span>
    </div>
    <div>
      <h4 className="text-xs font-extrabold text-slate-100 truncate">{title}</h4>
      <p className="text-[10px] text-slate-400 truncate">{sub}</p>
    </div>
    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
      <span>{latency}</span>
      <span className="text-cyan-400">{rowsSec}</span>
    </div>
  </div>
);
