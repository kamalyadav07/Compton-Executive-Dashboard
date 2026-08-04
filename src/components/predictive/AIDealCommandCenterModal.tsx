import React, { useState, useMemo } from 'react';
import { 
  Rocket, 
  X, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Target, 
  Sliders, 
  Sparkles, 
  ArrowRight, 
  DollarSign, 
  Layers
} from 'lucide-react';
import type { DealRecord } from '../../types/sales';
import { 
  globalCommandCenterEngine, 
  type SimulatorScenario 
} from '../../engine/aiDealCommandCenter';

interface AIDealCommandCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: DealRecord[];
}

export const AIDealCommandCenterModal: React.FC<AIDealCommandCenterModalProps> = ({
  isOpen,
  onClose,
  records
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'ranked' | 'roi' | 'simulator' | 'risks'>('summary');
  const [selectedDealId, setSelectedDealId] = useState<string>('');

  // Simulator Scenario Form state
  const [simSalesRep, setSimSalesRep] = useState<string>('');
  const [simDiscount, setSimDiscount] = useState<number>(0);
  const [simIncludeAMC, setSimIncludeAMC] = useState<boolean>(false);
  const [simSiteVisit, setSimSiteVisit] = useState<boolean>(false);
  const [simExecutiveCall, setSimExecutiveCall] = useState<boolean>(false);

  const { analyses, summary } = useMemo(() => {
    return globalCommandCenterEngine.analyzeAllInProgressDeals(records);
  }, [records]);

  // Default selected deal for simulator
  const activeSimDeal = useMemo(() => {
    if (selectedDealId) {
      return analyses.find(a => a.deal.id === selectedDealId) || analyses[0];
    }
    return analyses[0];
  }, [analyses, selectedDealId]);

  // Simulator computation
  const simResult = useMemo(() => {
    if (!activeSimDeal) return null;
    const scenario: SimulatorScenario = {
      reassignedSalesRep: simSalesRep || activeSimDeal.deal.salesRep,
      discountPct: simDiscount,
      includeAMC: simIncludeAMC,
      scheduleSiteVisit: simSiteVisit,
      scheduleExecutiveCall: simExecutiveCall
    };
    return globalCommandCenterEngine.simulateDealScenario(activeSimDeal, scenario);
  }, [activeSimDeal, simSalesRep, simDiscount, simIncludeAMC, simSiteVisit, simExecutiveCall]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-3 md:p-6 overflow-hidden animate-fade-in">
      <div className="glass-panel w-full max-w-7xl h-[94vh] rounded-3xl border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden bg-slate-950/95">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Rocket className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-slate-100 tracking-tight">
                  AI DEAL ANALYSIS
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                  Active Analysis
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-Engine Predictive Scoring, Expected Business Impact Ranking, ROI Optimization & What-If Simulator
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Executive Summary Top Cards (Phase 5) */}
        <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-800/80 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs shrink-0 font-sans">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Pipeline Value</span>
            <div className="text-base font-black text-slate-100 font-mono">₹{(summary.totalPipelineValue / 10000000).toFixed(2)} Cr</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] font-bold text-emerald-400 uppercase">Expected Revenue</span>
            <div className="text-base font-black text-emerald-400 font-mono">₹{(summary.expectedRevenue / 10000000).toFixed(2)} Cr</div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-[10px] font-bold text-rose-400 uppercase">Immediate Attention</span>
            <div className="text-base font-black text-rose-400 font-mono">{summary.dealsImmediateAttentionCount} Deals</div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[10px] font-bold text-blue-400 uppercase">High Prob (&gt;80%)</span>
            <div className="text-base font-black text-blue-400 font-mono">{summary.highProbabilityCount} Deals</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] font-bold text-amber-400 uppercase">Revenue at Risk</span>
            <div className="text-base font-black text-amber-400 font-mono">₹{(summary.revenueAtRisk / 10000000).toFixed(2)} Cr</div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <span className="text-[10px] font-bold text-purple-400 uppercase">Target Gap</span>
            <div className="text-base font-black text-purple-300 font-mono">₹{(summary.revenueGap / 100000).toFixed(1)}L</div>
          </div>
        </div>

        {/* Tab Ribbon */}
        <div className="px-6 py-2.5 bg-slate-900/40 border-b border-slate-800/80 flex items-center space-x-2 overflow-x-auto shrink-0 text-xs font-bold scrollbar-none">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3.5 py-1.5 rounded-xl flex items-center space-x-2 transition-all ${
              activeTab === 'summary' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>1. Director Executive Summary</span>
          </button>

          <button
            onClick={() => setActiveTab('ranked')}
            className={`px-3.5 py-1.5 rounded-xl flex items-center space-x-2 transition-all ${
              activeTab === 'ranked' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>2. Business Impact Ranked Deals ({analyses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('roi')}
            className={`px-3.5 py-1.5 rounded-xl flex items-center space-x-2 transition-all ${
              activeTab === 'roi' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>3. Opportunity ROI Score (Gain/Hour)</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3.5 py-1.5 rounded-xl flex items-center space-x-2 transition-all ${
              activeTab === 'simulator' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-purple-400 animate-spin" />
            <span>4. What-If Opportunity Simulator ⭐</span>
          </button>

          <button
            onClick={() => setActiveTab('risks')}
            className={`px-3.5 py-1.5 rounded-xl flex items-center space-x-2 transition-all ${
              activeTab === 'risks' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>5. Top Risks & Stuck Deals ({summary.stuckDeals.length})</span>
          </button>
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-y-auto p-6 text-slate-200">
          
          {/* TAB 1: Executive Summary */}
          {activeTab === 'summary' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Pipeline Win Distribution */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    Deal Closure Probability Breakdown
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-emerald-400">High Probability (&gt;80%)</span>
                        <span className="font-mono text-slate-200">{summary.highProbabilityCount} Deals</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(summary.highProbabilityCount / (analyses.length || 1)) * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-amber-400">Medium Probability (50-80%)</span>
                        <span className="font-mono text-slate-200">{summary.mediumProbabilityCount} Deals</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(summary.mediumProbabilityCount / (analyses.length || 1)) * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-rose-400">Low Probability (&lt;50%)</span>
                        <span className="font-mono text-slate-200">{summary.lowProbabilityCount} Deals</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                        <div className="bg-rose-500 h-full rounded-full" style={{ width: `${(summary.lowProbabilityCount / (analyses.length || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Target Achievement Forecast */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    Monthly Revenue Quotas
                  </h3>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Monthly Target Quota:</span>
                      <span className="font-mono font-bold text-slate-100">₹{(summary.monthlyTarget/100000).toFixed(1)} Lakhs</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Expected Closed Revenue:</span>
                      <span className="font-mono font-bold text-emerald-400">₹{(summary.expectedRevenue/100000).toFixed(1)} Lakhs</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">Achievement Forecast:</span>
                      <span className="text-base font-black text-indigo-400">{summary.expectedMonthlyAchievementPct}%</span>
                    </div>
                  </div>
                </div>

                {/* Director Quick Actions */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Recommended Director Focus
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Focus sales team efforts on <strong>{summary.dealsImmediateAttentionCount} Immediate Deals</strong> with high expected revenue gain per hour to close the ₹{(summary.revenueGap/100000).toFixed(1)}L revenue gap.
                  </p>
                  <button
                    onClick={() => setActiveTab('ranked')}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>View Prioritized Deals</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </div>

              {/* Top 10 Opportunities Table */}
              <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-extrabold uppercase text-slate-200 tracking-wider">Top 10 High-Impact Opportunities</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Rank</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Gross Value</th>
                        <th className="p-3">Win %</th>
                        <th className="p-3">Expected Value</th>
                        <th className="p-3">Priority</th>
                        <th className="p-3">Sales Rep</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {summary.topOpportunities.map(item => (
                        <tr key={item.deal.id} className="hover:bg-slate-900/50">
                          <td className="p-3 font-bold text-cyan-400">#{item.rank}</td>
                          <td className="p-3 font-sans font-bold text-slate-100">{item.deal.customer}</td>
                          <td className="p-3">₹{(item.deal.grossRevenue/100000).toFixed(2)}L</td>
                          <td className="p-3 text-emerald-400 font-bold">{item.scores.winProbability}%</td>
                          <td className="p-3 text-emerald-300 font-bold">₹{(item.expectedValue/100000).toFixed(2)}L</td>
                          <td className="p-3 font-sans">{item.priority}</td>
                          <td className="p-3 font-sans text-slate-400">{item.deal.salesRep}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Ranked Pipeline (Phase 3 & 4) */}
          {activeTab === 'ranked' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">AI Prioritization by Expected Business Impact</h3>
                  <p className="text-xs text-slate-400">Ranked by Expected Value (`Deal Value * Win Probability`) and Urgency Score.</p>
                </div>
              </div>

              <div className="space-y-4">
                {analyses.map((item) => (
                  <div key={item.deal.id} className="glass-panel p-5 rounded-2xl border border-slate-800/90 space-y-4 hover:border-slate-700 transition-all">
                    
                    {/* Header Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center space-x-3">
                        <span className="w-8 h-8 rounded-xl bg-blue-600/20 text-cyan-400 flex items-center justify-center font-mono font-black text-sm border border-blue-500/30">
                          #{item.rank}
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-base font-extrabold text-slate-100">{item.deal.customer}</h4>
                            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                              {item.priority}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {item.deal.solution} • {item.deal.industry} • Rep: <strong className="text-slate-200">{item.deal.salesRep}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6 text-right">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Gross Deal Value</span>
                          <div className="text-base font-black text-slate-100 font-mono">₹{(item.deal.grossRevenue/100000).toFixed(2)} Lakhs</div>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-emerald-400 uppercase">Expected Value</span>
                          <div className="text-base font-black text-emerald-400 font-mono">₹{(item.expectedValue/100000).toFixed(2)} Lakhs</div>
                        </div>
                      </div>
                    </div>

                    {/* Multi-Engine Scorecard Meters (Phase 2) */}
                    <div className="grid grid-cols-2 md:grid-cols-7 gap-2.5 text-center font-mono">
                      <ScoreMeter title="Win Prob" val={`${item.scores.winProbability}%`} color="emerald" sub="Win Prob" />
                      <ScoreMeter title="Confidence" val={`${item.scores.confidenceScore}%`} color="cyan" sub="Calibrated" />
                      <ScoreMeter title="Health" val={`${item.scores.customerHealthScore}/100`} color="purple" sub="Customer" />
                      <ScoreMeter title="Prop Quality" val={`${item.scores.proposalQualityScore}/100`} color="indigo" sub="Proposal" />
                      <ScoreMeter title="Rep Adv." val={`${item.scores.salespersonAdvantageScore}/100`} color="blue" sub="Salesperson" />
                      <ScoreMeter title="Similarity" val={`${item.scores.similarityScore}%`} color="amber" sub="Match" />
                      <ScoreMeter title="Urgency" val={`${item.scores.urgencyScore}/100`} color="rose" sub="Action Urgency" />
                    </div>

                    {/* AI Action Plan & Guidance (Phase 4) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      
                      {/* Strengths */}
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5 text-xs">
                        <span className="font-extrabold text-emerald-400 uppercase text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Strengths
                        </span>
                        <ul className="space-y-1 text-slate-300 text-[11px]">
                          {item.actionPlan.strengths.map((s, idx) => (
                            <li key={idx}>✓ {s}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Risks */}
                      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5 text-xs">
                        <span className="font-extrabold text-amber-400 uppercase text-[10px] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Risks & Objections
                        </span>
                        <ul className="space-y-1 text-slate-300 text-[11px]">
                          {item.actionPlan.risks.map((r, idx) => (
                            <li key={idx}>⚠ {r}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Recommended Actions & Jump */}
                      <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-1.5 text-xs flex flex-col justify-between">
                        <div>
                          <span className="font-extrabold text-cyan-400 uppercase text-[10px] flex items-center gap-1">
                            <Target className="w-3.5 h-3.5" />
                            Recommended Actions
                          </span>
                          <ul className="space-y-1 text-slate-300 text-[11px] mt-1">
                            {item.actionPlan.recommendedActions.map((a, idx) => (
                              <li key={idx}>👉 {a}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="pt-2 border-t border-blue-500/20 flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-400">Win Rate Improvement:</span>
                          <span className="text-emerald-400 font-bold">
                            {item.scores.winProbability}% → <strong className="text-emerald-300">{item.actionPlan.afterActionProbability}%</strong>
                          </span>
                        </div>
                      </div>

                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Opportunity ROI Score Matrix */}
          {activeTab === 'roi' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-100">Opportunity ROI Matrix (Sales Effort Optimization)</h3>
                <p className="text-xs text-slate-400">Calculates Expected Revenue Gain per Hour of Sales Effort (`Expected Value / Hours`).</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold sticky top-0">
                    <tr>
                      <th className="p-3">Deal / Customer</th>
                      <th className="p-3">Gross Value</th>
                      <th className="p-3">Win %</th>
                      <th className="p-3">Expected Value</th>
                      <th className="p-3">Est. Sales Effort</th>
                      <th className="p-3">Expected Gain / Hour</th>
                      <th className="p-3 text-right">ROI Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {analyses.map((item) => (
                      <tr key={item.deal.id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-sans font-bold text-slate-100">{item.deal.customer}</td>
                        <td className="p-3">₹{(item.deal.grossRevenue/100000).toFixed(2)}L</td>
                        <td className="p-3 text-emerald-400">{item.scores.winProbability}%</td>
                        <td className="p-3 text-emerald-300 font-bold">₹{(item.expectedValue/100000).toFixed(2)}L</td>
                        <td className="p-3 text-slate-400">{item.roi.estimatedHours} Hours</td>
                        <td className="p-3 font-bold text-cyan-400">₹{(item.roi.expectedGainPerHour/100000).toFixed(2)}L / hr</td>
                        <td className="p-3 text-right font-sans">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            item.roi.roiRank === 'Highest' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                            item.roi.roiRank === 'Very High' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            item.roi.roiRank === 'High' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {item.roi.roiRank}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: What-If Opportunity Simulator (Phase 6) */}
          {activeTab === 'simulator' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-purple-400" />
                  What-If Opportunity Simulator
                </h3>
                <p className="text-xs text-slate-400">Test strategic decisions (sales rep reassignment, price discounts, AMC bundles, executive visits) and watch probabilities update in real-time!</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Simulator Inputs Form */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
                  <h4 className="text-xs font-extrabold text-purple-400 uppercase tracking-wider">Configure Scenario Simulation</h4>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Select Deal:</label>
                    <select
                      value={selectedDealId || activeSimDeal?.deal.id}
                      onChange={(e) => {
                        setSelectedDealId(e.target.value);
                        setSimDiscount(0);
                        setSimIncludeAMC(false);
                        setSimSiteVisit(false);
                        setSimExecutiveCall(false);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs font-bold focus:outline-none focus:border-blue-500"
                    >
                      {analyses.map(a => (
                        <option key={a.deal.id} value={a.deal.id}>
                          {a.deal.customer} (₹{(a.deal.grossRevenue/100000).toFixed(1)}L - {a.scores.winProbability}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Reassign Sales Representative:</label>
                    <input
                      type="text"
                      value={simSalesRep || activeSimDeal?.deal.salesRep}
                      onChange={(e) => setSimSalesRep(e.target.value)}
                      placeholder="e.g. Sandeep / Jitesh"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
                      <span>Apply Strategic Price Discount:</span>
                      <span className="text-cyan-400 font-mono">{simDiscount}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={15}
                      step={1}
                      value={simDiscount}
                      onChange={(e) => setSimDiscount(Number(e.target.value))}
                      className="w-full accent-cyan-500"
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simIncludeAMC}
                        onChange={(e) => setSimIncludeAMC(e.target.checked)}
                        className="rounded accent-purple-500"
                      />
                      <span className="text-slate-200 font-bold">Include AMC & Extended Warranty Bundle</span>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simSiteVisit}
                        onChange={(e) => setSimSiteVisit(e.target.checked)}
                        className="rounded accent-purple-500"
                      />
                      <span className="text-slate-200 font-bold">Schedule Immediate Executive Site Visit</span>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simExecutiveCall}
                        onChange={(e) => setSimExecutiveCall(e.target.checked)}
                        className="rounded accent-purple-500"
                      />
                      <span className="text-slate-200 font-bold">Schedule Sponsor Alignment Call</span>
                    </label>
                  </div>
                </div>

                {/* Real-time Recalculated Results */}
                {simResult && activeSimDeal && (
                  <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-purple-500/30 bg-purple-950/10 space-y-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
                        <div>
                          <h4 className="text-lg font-black text-slate-100">{activeSimDeal.deal.customer} Simulation Output</h4>
                          <p className="text-xs text-slate-400">Current Sales Rep: {activeSimDeal.deal.salesRep} | Base Value: ₹{(activeSimDeal.deal.grossRevenue/100000).toFixed(2)}L</p>
                        </div>
                        <span className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-bold text-xs border border-purple-500/30">
                          Scenario Recalculated
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Base Win Prob</span>
                          <div className="text-xl font-extrabold text-slate-300 font-mono">{activeSimDeal.scores.winProbability}%</div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase">New Win Prob</span>
                          <div className="text-2xl font-black text-emerald-400 font-mono">
                            {simResult.updatedWinProbability}%
                            {simResult.deltaProbability !== 0 && (
                              <span className="text-xs ml-1 text-emerald-300">({simResult.deltaProbability > 0 ? '+' : ''}{simResult.deltaProbability}%)</span>
                            )}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Base Exp. Value</span>
                          <div className="text-xl font-extrabold text-slate-300 font-mono">₹{(activeSimDeal.expectedValue/100000).toFixed(2)}L</div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                          <span className="text-[10px] font-bold text-cyan-400 uppercase">New Exp. Value</span>
                          <div className="text-2xl font-black text-cyan-400 font-mono">₹{(simResult.updatedExpectedValue/100000).toFixed(2)}L</div>
                        </div>
                      </div>

                      {/* Explanation */}
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                        <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" />
                          Evidence-Based Explanation
                        </span>
                        <p className="text-xs text-slate-300 leading-relaxed font-mono">
                          {simResult.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* TAB 5: Top Risks & Stuck Deals */}
          {activeTab === 'risks' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-slate-100">Top 10 At-Risk Opportunities & Stagnant Deals</h3>
                <p className="text-xs text-slate-400">Deals stagnant in pipeline for &gt;15 days or with win probability &lt;50%.</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold sticky top-0">
                    <tr>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Gross Value</th>
                      <th className="p-3">Stage</th>
                      <th className="p-3">Days in Stage</th>
                      <th className="p-3">Win %</th>
                      <th className="p-3">Sales Rep</th>
                      <th className="p-3 text-right">Recovery Plan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {summary.topRisks.map((item) => (
                      <tr key={item.deal.id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-sans font-bold text-slate-100">{item.deal.customer}</td>
                        <td className="p-3">₹{(item.deal.grossRevenue/100000).toFixed(2)}L</td>
                        <td className="p-3 text-amber-400 font-sans">{item.deal.stage}</td>
                        <td className="p-3 text-rose-400 font-bold">{item.daysInStage} Days</td>
                        <td className="p-3 text-rose-400 font-bold">{item.scores.winProbability}%</td>
                        <td className="p-3 font-sans text-slate-400">{item.deal.salesRep}</td>
                        <td className="p-3 text-right font-sans">
                          <button
                            onClick={() => {
                              setSelectedDealId(item.deal.id);
                              setActiveTab('simulator');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-[11px] font-bold transition-all ml-auto"
                          >
                            Simulate Recovery
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

interface ScoreMeterProps {
  title: string;
  val: string;
  color: 'emerald' | 'cyan' | 'purple' | 'indigo' | 'blue' | 'amber' | 'rose';
  sub: string;
}

const ScoreMeter: React.FC<ScoreMeterProps> = ({ title, val, color, sub }) => {
  const colorClass = {
    emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
    cyan: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5',
    purple: 'text-purple-300 border-purple-500/30 bg-purple-500/5',
    indigo: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/5',
    blue: 'text-blue-400 border-blue-500/30 bg-blue-500/5',
    amber: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
    rose: 'text-rose-400 border-rose-500/30 bg-rose-500/5'
  }[color];

  return (
    <div className={`p-2.5 rounded-xl border ${colorClass} flex flex-col justify-between`}>
      <span className="text-[10px] font-extrabold text-slate-400 uppercase font-sans truncate">{title}</span>
      <div className="text-base font-black font-mono my-0.5">{val}</div>
      <span className="text-[9px] text-slate-500 font-sans truncate">{sub}</span>
    </div>
  );
};
