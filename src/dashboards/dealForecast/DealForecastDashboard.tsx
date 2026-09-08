import React, { useMemo, useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ArrowUpDown, ChevronUp, ChevronDown, Info, Search,
  TrendingUp, TrendingDown, Minus, Zap, Calendar
} from 'lucide-react';
import type { DealRecord } from '../../types/sales';
import { runDealIntelligence, type DealIntelligenceResult } from '../../engine/dealIntelligenceEngine';
import {
  computeSalesProjection,
  type SalesProjection
} from '../../engine/salesProjectionEngine';

import { COMPANY_MONTHLY_TARGET, COMPANY_YEARLY_TARGET, INDIVIDUAL_REP_MONTHLY_TARGETS } from '../../config/salesTargets';

// ── Types ──────────────────────────────────────────────────────────────

type SortKey =
  | 'dealId'
  | 'customer'
  | 'dealTitle'
  | 'amount'
  | 'salesRep'
  | 'stage'
  | 'closureProbability'
  | 'winProbabilityPct'
  | 'expectedCloseDate'
  | 'ageDays';

type SortDir = 'asc' | 'desc';
type PipelineFilter = '7d' | '15d' | 'all';

interface Targets {
  monthlyTarget: number;
  yearlyTarget: number;
  repTargets: Record<string, number>;
}

const DEFAULT_TARGETS: Targets = {
  monthlyTarget: COMPANY_MONTHLY_TARGET,
  yearlyTarget: COMPANY_YEARLY_TARGET,
  repTargets: INDIVIDUAL_REP_MONTHLY_TARGETS
};

interface ProjectionSnapshot {
  date: string;
  monthProjection: number;
  fyProjection: number;
}

interface DealForecastDashboardProps {
  allRecords: DealRecord[];
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatINRFull(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function attainmentColor(pct: number): string {
  if (pct >= 100) return '#10b981'; // emerald
  if (pct >= 85) return '#f59e0b';  // amber
  return '#f43f5e';                  // rose
}

// ── Gauge Chart (ECharts) ────────────────────────────────────────────────

const GaugeChart: React.FC<{ pct: number }> = ({ pct }) => {
  const color = attainmentColor(pct);
  const displayPct = Math.min(pct, 150); // cap visual at 150% so 100% reads as full

  const option = useMemo(() => ({
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 150,
      splitNumber: 3,
      radius: '95%',
      center: ['50%', '65%'],
      pointer: { show: false },
      progress: {
        show: true,
        overlap: false,
        roundCap: true,
        clip: false,
        itemStyle: { color }
      },
      axisLine: {
        lineStyle: { width: 10, color: [[1, '#1e293b']] }
      },
      splitLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      detail: {
        valueAnimation: true,
        formatter: (val: number) => `${val.toFixed(0)}%`,
        color,
        fontSize: 20,
        fontWeight: 'bold',
        offsetCenter: [0, '10%'],
        fontFamily: 'ui-monospace, monospace'
      },
      data: [{ value: displayPct }]
    }]
  }), [displayPct, color]);

  return (
    <ReactECharts
      option={option}
      style={{ height: '130px', width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  );
};

// ── Trend Indicator ──────────────────────────────────────────────────────

const TrendIndicator: React.FC<{
  current: number;
  snapshots: ProjectionSnapshot[];
  scope: 'month' | 'fy';
}> = ({ current, snapshots, scope }) => {
  if (snapshots.length < 2) return null;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = snapshots
    .filter(s => s.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!yesterday) return null;

  const prev = scope === 'month' ? yesterday.monthProjection : yesterday.fyProjection;
  const delta = current - prev;
  const deltaPct = prev > 0 ? (delta / prev) * 100 : 0;

  if (Math.abs(deltaPct) < 0.1) return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
      <Minus className="w-3 h-3" /> No change vs yesterday
    </span>
  );

  const up = delta > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
      {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {up ? '+' : ''}{formatINR(delta)} ({deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%) vs yesterday
    </span>
  );
};

// ── Projection Card ──────────────────────────────────────────────────────

const ProjectionCard: React.FC<{
  label: string;
  projection: SalesProjection;
  snapshots: ProjectionSnapshot[];
  scope: 'month' | 'fy';
}> = ({ label, projection, snapshots, scope }) => {
  const { revenueToDate, weightedForecastAdditional, totalProjection, target, gapToTarget, projectedAttainmentPct, onTrack } = projection;
  const color = attainmentColor(projectedAttainmentPct);
  const statusLabel = projectedAttainmentPct >= 100 ? 'On Track' : projectedAttainmentPct >= 85 ? 'At Risk' : 'Off Track';
  const statusBg = projectedAttainmentPct >= 100
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : projectedAttainmentPct >= 85
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 p-5 flex flex-col gap-4 bg-slate-900/60">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
          <p className="text-slate-300 text-sm mt-0.5">{projection.period}</p>
        </div>
        <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider border rounded-lg ${statusBg}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_130px] gap-4 items-start">
        {/* Left: numbers */}
        <div className="space-y-2.5">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Projection</p>
            <p className="text-2xl font-black tracking-tight" style={{ color }}>{formatINR(totalProjection)}</p>
            <TrendIndicator current={totalProjection} snapshots={snapshots} scope={scope} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/50 rounded-lg p-2.5">
              <p className="text-[10px] text-slate-500">Booked (net)</p>
              <p className="text-sm font-bold text-slate-100">{formatINR(revenueToDate)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2.5">
              <p className="text-[10px] text-slate-500">Weighted Forecast</p>
              <p className="text-sm font-bold text-slate-100">{formatINR(weightedForecastAdditional)}</p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-2.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-500">Target</p>
              <p className="text-sm font-bold text-slate-200">{formatINR(target)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500">{onTrack ? 'Surplus' : 'Gap to Target'}</p>
              <p className={`text-sm font-bold ${onTrack ? 'text-emerald-400' : 'text-rose-400'}`}>
                {onTrack ? '+' : '-'}{formatINR(Math.abs(gapToTarget))}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Gauge */}
        <div className="-mt-2">
          <GaugeChart pct={projectedAttainmentPct} />
          <p className="text-[10px] text-center text-slate-500 -mt-3">of target</p>
        </div>
      </div>
    </div>
  );
};

// ── Focus Deals ──────────────────────────────────────────────────────────

const FocusDeals: React.FC<{ projection: SalesProjection }> = ({ projection }) => {
  const deals = projection.topDealsLikelyToClose;
  if (deals.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider">Focus Deals — Call These Today</h2>
        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">
          {deals.length} high-confidence
        </span>
      </div>
      <p className="text-xs text-slate-500">Win probability ≥ 60% AND meaningful close likelihood — the deals actually worth calling today.</p>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {deals.map(deal => {
          const prob = deal.winProbabilityPct;
          const probColor = prob >= 70 ? 'text-emerald-400' : prob >= 50 ? 'text-amber-400' : 'text-rose-400';
          return (
            <div
              key={deal.dealName}
              className="shrink-0 w-60 bg-slate-900/80 border border-amber-500/20 rounded-xl p-3.5 space-y-2 hover:border-amber-500/40 transition-colors"
            >
              <div>
                <p className="text-xs font-bold text-slate-100 truncate" title={deal.dealName}>{deal.dealName}</p>
                <p className="text-[11px] text-slate-400 truncate">{deal.company}</p>
              </div>
              <div className="text-base font-black text-emerald-400">{formatINRFull(deal.netValue)}</div>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${probColor}`}>{prob}% win prob</span>
                {deal.closureProbability !== null && deal.closureProbability !== undefined && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 font-mono border border-teal-500/30" title={`Rep Closure Prob: ${deal.closureProbabilityLabel || deal.closureProbability + '%'}`}>
                    Rep: {deal.closureProbability}%
                  </span>
                )}
                <span className="text-[11px] text-slate-500">{deal.expectedCloseDate}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: `${prob}%`, background: attainmentColor(prob) }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Main Dashboard ───────────────────────────────────────────────────────

export const DealForecastDashboard: React.FC<DealForecastDashboardProps> = ({ allRecords }) => {
  const [sortKey, setSortKey] = useState<SortKey>('winProbabilityPct');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>('all');
  const [targets, setTargets] = useState<Targets>(DEFAULT_TARGETS);
  const [snapshots, setSnapshots] = useState<ProjectionSnapshot[]>([]);

  // Fetch targets from server (if server API exists; else falls back to DEFAULT_TARGETS)
  useEffect(() => {
    fetch('/api/targets')
      .then(r => {
        const ct = r.headers.get('content-type') || '';
        if (r.ok && ct.includes('application/json')) return r.json();
        return null;
      })
      .then(data => {
        if (data && data.monthlyTarget) setTargets(data);
      })
      .catch(() => {});
  }, []);

  // Fetch trend snapshots
  useEffect(() => {
    fetch('/api/projection/snapshots')
      .then(r => r.json())
      .then(setSnapshots)
      .catch(console.error);
  }, []);

  // ── Engine computations — NO arithmetic in UI code below this line ──

  const { results: intelligenceResults, model } = useMemo(
    () => runDealIntelligence(allRecords),
    [allRecords]
  );

  const monthProjection = useMemo<SalesProjection | null>(() => {
    if (!targets) return null;
    return computeSalesProjection(allRecords, 'month', targets);
  }, [allRecords, targets]);

  const fyProjection = useMemo<SalesProjection | null>(() => {
    if (!targets) return null;
    return computeSalesProjection(allRecords, 'fy', targets);
  }, [allRecords, targets]);

  // Set of deal IDs that are in the focus list
  const focusDealNames = useMemo(() => {
    if (!monthProjection) return new Set<string>();
    return new Set(monthProjection.topDealsLikelyToClose.map(d => d.dealName));
  }, [monthProjection]);

  // Helper to determine if a deal closes within a target day window (by expected close date or close likelihood)
  const isClosingInWindow = useCallback((r: DealIntelligenceResult, days: number) => {
    // Stalled / dormant deals with customer quiet for 14+ days and age > 60d cannot close within 7 or 15 days
    if ((r.daysSinceLastUpdate >= 14 || r.qualitativeSignals?.customerWentQuiet || r.qualitativeSignals?.dealStalled) && r.ageDays > 60) {
      return false;
    }

    const pct = days <= 7 ? r.closesWithin7DaysPct : r.closesWithin15DaysPct;

    // 1. High empirical closing probability within this window
    if (pct >= 50) return true;

    // 2. Expected close date is within the window AND deal has active momentum
    if (r.expectedCloseDate) {
      const targetDate = new Date(r.expectedCloseDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= days) {
        return pct >= 15 && r.daysSinceLastUpdate < 14;
      }
    }
    return false;
  }, []);

  // ── Table filtering & sorting ────────────────────────────────────────

  const filtered = useMemo(() => {
    let base = intelligenceResults;

    // Pipeline filter tabs (deals closing this week or within 15 days)
    if (pipelineFilter === '7d') {
      base = base.filter(r => isClosingInWindow(r, 7));
    } else if (pipelineFilter === '15d') {
      base = base.filter(r => isClosingInWindow(r, 15));
    }

    // Text search
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().trim();
    return base.filter(r => {
      const rawId = (r.deal.id || '').toLowerCase();
      const cleanId = rawId.replace(/[^0-9]/g, '');
      return (
        rawId.includes(q) ||
        cleanId.includes(q) ||
        (r.deal.customer || '').toLowerCase().includes(q) ||
        (r.deal.rawRecord?.TITLE || '').toLowerCase().includes(q) ||
        (r.deal.salesRep || '').toLowerCase().includes(q) ||
        (r.deal.stage || '').toLowerCase().includes(q) ||
        (r.deal.solution || '').toLowerCase().includes(q) ||
        (r.repClosureProbabilityLabel || '').toLowerCase().includes(q) ||
        (r.repClosureProbability !== null && `${r.repClosureProbability}%`.includes(q))
      );
    });
  }, [intelligenceResults, searchQuery, pipelineFilter, isClosingInWindow]);

  const count7d = useMemo(
    () => intelligenceResults.filter(r => isClosingInWindow(r, 7)).length,
    [intelligenceResults, isClosingInWindow]
  );
  const count15d = useMemo(
    () => intelligenceResults.filter(r => isClosingInWindow(r, 15)).length,
    [intelligenceResults, isClosingInWindow]
  );

  const sorted = useMemo(() => {
    const compare = (a: DealIntelligenceResult, b: DealIntelligenceResult): number => {
      let va: string | number;
      let vb: string | number;
      switch (sortKey) {
        case 'dealId':
          va = parseInt(a.deal.id.replace(/[^0-9]/g, ''), 10) || 0;
          vb = parseInt(b.deal.id.replace(/[^0-9]/g, ''), 10) || 0;
          break;
        case 'customer':
          va = a.deal.customer.toLowerCase();
          vb = b.deal.customer.toLowerCase();
          break;
        case 'dealTitle':
          va = (a.deal.rawRecord?.TITLE || a.deal.customer).toLowerCase();
          vb = (b.deal.rawRecord?.TITLE || b.deal.customer).toLowerCase();
          break;
        case 'amount':
          va = a.deal.grossRevenue || a.deal.netRevenue;
          vb = b.deal.grossRevenue || b.deal.netRevenue;
          break;
        case 'salesRep':
          va = a.deal.salesRep.toLowerCase();
          vb = b.deal.salesRep.toLowerCase();
          break;
        case 'stage':
          va = a.deal.stage.toLowerCase();
          vb = b.deal.stage.toLowerCase();
          break;
        case 'closureProbability':
          va = a.repClosureProbability !== null && a.repClosureProbability !== undefined ? a.repClosureProbability : -1;
          vb = b.repClosureProbability !== null && b.repClosureProbability !== undefined ? b.repClosureProbability : -1;
          break;
        case 'expectedCloseDate':
          va = a.expectedCloseDate;
          vb = b.expectedCloseDate;
          break;
        default:
          va = a[sortKey];
          vb = b[sortKey];
          break;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;

      // ── Stable Tie Breakers ──
      // 1. Secondary: closesWithin15DaysPct (descending)
      if (b.closesWithin15DaysPct !== a.closesWithin15DaysPct) {
        return b.closesWithin15DaysPct - a.closesWithin15DaysPct;
      }
      // 2. Tertiary: Net Revenue (descending)
      const revA = a.deal.netRevenue || a.deal.grossRevenue || 0;
      const revB = b.deal.netRevenue || b.deal.grossRevenue || 0;
      if (revB !== revA) {
        return revB - revA;
      }
      // 3. Quaternary: Deal ID string comparison (ascending)
      return a.deal.id.localeCompare(b.deal.id);
    };
    return [...filtered].sort(compare);
  }, [filtered, sortKey, sortDir]);

  const totalShownValue = useMemo(
    () => sorted.reduce((sum, r) => sum + (r.deal.grossRevenue || r.deal.netRevenue || 0), 0),
    [sorted]
  );

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  const SortIcon: React.FC<{ col: SortKey }> = ({ col }) => {
    if (sortKey !== col) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-40 group-hover:opacity-80 transition-opacity shrink-0" />;
    }
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
    );
  };

  const filterTabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer select-none inline-flex items-center gap-1.5 ${
      active
        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
        : 'bg-slate-800/70 text-slate-400 border border-slate-700/80 hover:text-slate-200 hover:bg-slate-800'
    }`;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">Deal Forecast & Projections</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
              AI Forecast Engine
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Predictive sales pipeline analytics grounded in Bitrix24 historical win rates and empirical cycle curves.
          </p>
        </div>
      </div>

      {/* ── Projection Summary Cards ── */}
      {targets ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {monthProjection && (
            <ProjectionCard
              label="This Month"
              projection={monthProjection}
              snapshots={snapshots}
              scope="month"
            />
          )}
          {fyProjection && (
            <ProjectionCard
              label="Financial Year"
              projection={fyProjection}
              snapshots={snapshots}
              scope="fy"
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="glass-panel rounded-2xl border border-slate-800 p-5 h-52 animate-pulse bg-slate-900/40" />
          ))}
        </div>
      )}

      {/* ── Focus Deals ── */}
      {monthProjection && <FocusDeals projection={monthProjection} />}

      {/* ── Search & Model Info Banner ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
        <div className="relative lg:col-span-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Deal ID, Name, Customer, Rep..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>
        <div className="lg:col-span-2 glass-panel px-4 py-2.5 rounded-xl border border-slate-800 flex items-start space-x-2.5 bg-slate-900/60">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-200">How Win Probability Works:</strong> Win probability blends sales reps' active Closure Probability assessments (0%–100%) with five core machine learning factors: historical rep win rate, deal size ratio vs rep baseline, pipeline age, stage progress, and industry win rates, calibrated against {model.trainedOn} historical closed deals.
          </div>
        </div>
      </div>

      {/* ── Pipeline Filter & Stats Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs text-slate-400 font-semibold mr-1">Filter Pipeline:</span>
          <button className={filterTabClass(pipelineFilter === 'all')} onClick={() => setPipelineFilter('all')}>
            All Open Deals ({intelligenceResults.length})
          </button>
          <button className={filterTabClass(pipelineFilter === '7d')} onClick={() => setPipelineFilter('7d')}>
            Closing This Week (≤7d) ({count7d})
          </button>
          <button className={filterTabClass(pipelineFilter === '15d')} onClick={() => setPipelineFilter('15d')}>
            Closing ≤15 Days ({count15d})
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 self-end sm:self-auto">
          <span>Showing <strong className="text-slate-200">{sorted.length}</strong> of {intelligenceResults.length} deals</span>
          <span className="text-slate-700">|</span>
          <span>Pipeline Value: <strong className="text-emerald-400 font-mono">₹{totalShownValue.toLocaleString('en-IN')}</strong></span>
        </div>
      </div>

      {/* ── Deal Intelligence Table ── */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-900/60 shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs min-w-[1150px] border-collapse">
            <thead className="bg-slate-950/90 backdrop-blur-md sticky top-0 z-10 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 select-none">
              <tr>
                <th
                  className={`py-3.5 px-4 w-[120px] cursor-pointer transition-colors select-none whitespace-nowrap group ${
                    sortKey === 'dealId' ? 'text-cyan-300 bg-cyan-500/[0.05]' : 'hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  onClick={() => toggleSort('dealId')}
                >
                  <div className="inline-flex items-center gap-1.5">
                    <span>Bitrix ID</span>
                    <SortIcon col="dealId" />
                  </div>
                </th>
                <th
                  className={`py-3.5 px-4 min-w-[280px] cursor-pointer transition-colors select-none whitespace-nowrap group ${
                    sortKey === 'customer' || sortKey === 'dealTitle' ? 'text-cyan-300 bg-cyan-500/[0.05]' : 'hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  onClick={() => toggleSort('customer')}
                >
                  <div className="inline-flex items-center gap-1.5">
                    <span>Customer & Deal</span>
                    <SortIcon col="customer" />
                  </div>
                </th>
                <th
                  className={`py-3.5 px-4 w-[165px] text-right cursor-pointer transition-colors select-none whitespace-nowrap group ${
                    sortKey === 'amount' ? 'text-cyan-300 bg-cyan-500/[0.05]' : 'hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  onClick={() => toggleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-1.5 w-full">
                    <span>Amount (Gross/Net)</span>
                    <SortIcon col="amount" />
                  </div>
                </th>
                <th
                  className={`py-3.5 px-4 w-[150px] cursor-pointer transition-colors select-none whitespace-nowrap group ${
                    sortKey === 'salesRep' ? 'text-cyan-300 bg-cyan-500/[0.05]' : 'hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  onClick={() => toggleSort('salesRep')}
                >
                  <div className="inline-flex items-center gap-1.5">
                    <span>Sales Rep</span>
                    <SortIcon col="salesRep" />
                  </div>
                </th>
                <th
                  className={`py-3.5 px-4 w-[140px] cursor-pointer transition-colors select-none whitespace-nowrap group ${
                    sortKey === 'stage' ? 'text-cyan-300 bg-cyan-500/[0.05]' : 'hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  onClick={() => toggleSort('stage')}
                >
                  <div className="inline-flex items-center gap-1.5">
                    <span>Stage</span>
                    <SortIcon col="stage" />
                  </div>
                </th>
                <th
                  className={`py-3.5 px-4 w-[140px] text-center cursor-pointer transition-colors select-none whitespace-nowrap group ${
                    sortKey === 'closureProbability' ? 'text-cyan-300 bg-cyan-500/[0.05]' : 'hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  onClick={() => toggleSort('closureProbability')}
                >
                  <div className="flex items-center justify-center gap-1.5 w-full">
                    <span>Closure Prob (Rep)</span>
                    <SortIcon col="closureProbability" />
                  </div>
                </th>
                <th
                  className={`py-3.5 px-4 w-[135px] text-center cursor-pointer transition-colors select-none whitespace-nowrap group ${
                    sortKey === 'winProbabilityPct' ? 'text-cyan-300 bg-cyan-500/[0.05]' : 'hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  onClick={() => toggleSort('winProbabilityPct')}
                >
                  <div className="flex items-center justify-center gap-1.5 w-full">
                    <span>Win Prob % (AI)</span>
                    <SortIcon col="winProbabilityPct" />
                  </div>
                </th>
                <th
                  className={`py-3.5 px-4 w-[135px] text-center cursor-pointer transition-colors select-none whitespace-nowrap group ${
                    sortKey === 'expectedCloseDate' ? 'text-cyan-300 bg-cyan-500/[0.05]' : 'hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  onClick={() => toggleSort('expectedCloseDate')}
                >
                  <div className="flex items-center justify-center gap-1.5 w-full">
                    <span>Expected Close</span>
                    <SortIcon col="expectedCloseDate" />
                  </div>
                </th>
                <th
                  className={`py-3.5 px-4 w-[100px] text-right cursor-pointer transition-colors select-none whitespace-nowrap group ${
                    sortKey === 'ageDays' ? 'text-cyan-300 bg-cyan-500/[0.05]' : 'hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  onClick={() => toggleSort('ageDays')}
                >
                  <div className="flex items-center justify-end gap-1.5 w-full">
                    <span>Age (Days)</span>
                    <SortIcon col="ageDays" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-8 h-8 text-slate-600 mb-1" />
                      <span className="font-semibold text-slate-300">No matching in-progress deals found</span>
                      <span className="text-xs text-slate-500">Try adjusting your search query or pipeline filter</span>
                    </div>
                  </td>
                </tr>
              )}
              {sorted.map(r => {
                const dealIdStr = r.deal.id.startsWith('BITRIX-') ? r.deal.id : `BITRIX-${r.deal.id}`;
                const dealTitle = r.deal.rawRecord?.TITLE || `${r.deal.customer} (${r.deal.solution})`;
                const bitrixAmount = r.deal.grossRevenue || r.deal.netRevenue;
                const isFocusDeal = focusDealNames.has(dealTitle) || focusDealNames.has(r.deal.customer);
                const repInitials = (r.deal.salesRep || '')
                  .split(' ')
                  .filter(Boolean)
                  .map(n => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || 'SR';

                return (
                  <tr
                    key={r.deal.id}
                    className={`group hover:bg-slate-800/40 transition-colors duration-150 ${
                      isFocusDeal ? 'bg-amber-500/[0.03] border-l-2 border-amber-500' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap align-middle">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        isFocusDeal
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      }`}>
                        {dealIdStr}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 align-middle">
                      <div className="flex items-center gap-1.5">
                        {isFocusDeal && <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 fill-amber-400/20" />}
                        <div className="font-bold text-slate-100 text-xs sm:text-sm truncate" title={r.deal.customer}>
                          {r.deal.customer}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 font-normal truncate mt-0.5 max-w-[340px]" title={dealTitle}>
                        {dealTitle}
                      </div>
                      {r.ensembleScore?.activeSignals && r.ensembleScore.activeSignals.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {r.ensembleScore.activeSignals.map((sig, idx) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border tracking-wide ${sig.badgeStyle}`}
                              title={sig.description}
                            >
                              {sig.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap align-middle">
                      <div className="font-bold text-xs sm:text-sm text-emerald-400">
                        ₹{bitrixAmount.toLocaleString('en-IN')}
                      </div>
                      {r.deal.gstAmount > 0 && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Net: ₹{r.deal.netRevenue.toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                          {repInitials}
                        </div>
                        <span className="text-xs text-slate-300 font-medium">{r.deal.salesRep || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-800/90 text-slate-300 border border-slate-700/80">
                        {r.deal.stage}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono align-middle">
                      {r.repClosureProbability !== null && r.repClosureProbability !== undefined ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                            r.repClosureProbability >= 100
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : r.repClosureProbability >= 75
                              ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                              : r.repClosureProbability >= 50
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : r.repClosureProbability >= 25
                              ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          }`}
                          title={r.repClosureProbabilityLabel || `${r.repClosureProbability}% Closure Probability`}
                        >
                          {r.repClosureProbability}%
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]" title="Not selected in Bitrix">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono align-middle">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className={`font-bold text-xs ${
                          r.winProbabilityPct >= 70
                            ? 'text-emerald-400'
                            : r.winProbabilityPct >= 40
                            ? 'text-cyan-400'
                            : 'text-amber-400'
                        }`}>
                          {r.winProbabilityPct}%
                        </span>
                        <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              r.winProbabilityPct >= 70
                                ? 'bg-emerald-400'
                                : r.winProbabilityPct >= 40
                                ? 'bg-cyan-400'
                                : 'bg-amber-400'
                            }`}
                            style={{ width: `${Math.min(Math.max(r.winProbabilityPct, 5), 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-xs whitespace-nowrap align-middle">
                      <span className={
                        isClosingInWindow(r, 7)
                          ? 'text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20'
                          : 'text-slate-300'
                      }>
                        {r.expectedCloseDate}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs whitespace-nowrap align-middle">
                      <span className={
                        r.ageDays > 90
                          ? 'text-rose-400 font-bold'
                          : r.ageDays > 45
                          ? 'text-amber-400 font-medium'
                          : 'text-slate-400'
                      }>
                        {r.ageDays}d
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DealForecastDashboard;
