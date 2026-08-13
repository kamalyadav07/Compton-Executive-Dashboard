import React, { useState, useMemo } from 'react';
import { 
  Award, 
  Target, 
  PieChart, 
  Activity, 
  CheckCircle, 
  ShieldAlert, 
  Clock, 
  Zap,
  BarChart3,
  Layers,
  MousePointerClick
} from 'lucide-react';
import type { KPIMetrics, DealRecord } from '../../types/sales';
import { KPICardDetailModal } from './KPICardDetailModal';
import { getFYBounds } from '../../engine/salesProjectionEngine';

interface KPICardsGridProps {
  kpis: KPIMetrics;
  records?: DealRecord[];
  allRecords?: DealRecord[];
}

interface ActiveModalState {
  metricKey: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const formatCurrency = (val: number): string => {
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  } else if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)} L`;
  }
  return `₹${val.toLocaleString('en-IN')}`;
};

const GaugeArc: React.FC<{ percentage: number; colorClass?: string }> = ({ percentage, colorClass = "text-emerald-400" }) => {
  const clamped = Math.min(100, Math.max(0, percentage));
  const strokeDasharray = 251.2;
  const strokeDashoffset = strokeDasharray - (strokeDasharray * clamped * 0.75) / 100;

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-135" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke="currentColor"
          strokeWidth="10"
          className="text-slate-800/80 fill-none"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke="currentColor"
          strokeWidth="10"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`${colorClass} fill-none transition-all duration-1000 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-base font-black text-white font-mono">{clamped.toFixed(0)}%</span>
        <span className="text-[9px] text-slate-400 font-medium">of target</span>
      </div>
    </div>
  );
};

export const KPICardsGrid: React.FC<KPICardsGridProps> = ({ kpis, records = [], allRecords = [] }) => {
  const [activeModal, setActiveModal] = useState<ActiveModalState | null>(null);

  const openCardModal = (metricKey: string, title: string, subtitle: string, icon: React.ReactNode) => {
    setActiveModal({ metricKey, title, subtitle, icon });
  };

  const activeRecordsList = records.length > 0 ? records : allRecords;

  // 1. Annual Performance Date Filter Exemption (April 1st to today across allRecords)
  const fyMetrics = useMemo(() => {
    const pool = (allRecords && allRecords.length > 0) ? allRecords : activeRecordsList;
    const fyBounds = getFYBounds();

    const fyWonList = pool.filter(r => {
      const isWon = r.type === 'won' || r.stage?.toLowerCase().includes('won');
      if (!isWon) return false;
      const closeDate = new Date(r.rawRecord?.CLOSEDATE || r.rawRecord?.DATE_MODIFY || r.date);
      if (isNaN(closeDate.getTime())) return true;
      return closeDate >= fyBounds.start && closeDate <= fyBounds.end;
    });

    const achievementValue = fyWonList.reduce((acc, r) => acc + (r.grossRevenue || r.netRevenue || 0), 0);
    const target = kpis.yearlyTarget || 200000000;
    const achievementPct = target > 0 ? Math.round((achievementValue / target) * 1000) / 10 : 0;
    const remainingTarget = Math.max(0, target - achievementValue);

    return {
      target,
      achievementValue,
      achievementPct,
      remainingTarget
    };
  }, [allRecords, activeRecordsList, kpis.yearlyTarget]);

  // 2. Won & Lost Deals Values for Conversion Box
  const wonDealsValue = useMemo(() => {
    const wonList = activeRecordsList.filter(r => r.type === 'won' || r.stage?.toLowerCase().includes('won'));
    if (wonList.length > 0) {
      return wonList.reduce((acc, r) => acc + (r.grossRevenue || r.netRevenue || 0), 0);
    }
    return kpis.totalGrossRevenue;
  }, [activeRecordsList, kpis.totalGrossRevenue]);

  const lostDealsValue = useMemo(() => {
    const lostList = activeRecordsList.filter(r => r.type === 'lost' || r.stage?.toLowerCase().includes('lost'));
    return lostList.reduce((acc, r) => acc + (r.grossRevenue || r.netRevenue || 0), 0);
  }, [activeRecordsList]);

  return (
    <div className="w-full mb-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Executive Performance Summary</span>
        </h3>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
          <MousePointerClick className="w-3 h-3 text-blue-400" />
          <span>Click any card to inspect underlying deals & export</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* 1. YEARLY PERFORMANCE COMPOUND CARD (Unaffected by Month/Date Filter - April 1st to Today) */}
        <div className="bg-[#0f172a]/95 backdrop-blur-md p-5 rounded-2xl border border-indigo-500/30 relative overflow-hidden shadow-xl flex flex-col justify-between space-y-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Target className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-white tracking-wide uppercase">ANNUAL PERFORMANCE</h4>
                <p className="text-[10px] text-slate-400 font-mono">FY 2026-27 (Apr 1 - Today • Date Filter Exempt)</p>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
              fyMetrics.achievementPct >= 80 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              {fyMetrics.achievementPct >= 80 ? 'ON TRACK' : 'NEEDS PUSH'}
            </span>
          </div>

          {/* Hero Row: Achievement Value + Arc Gauge */}
          <div className="flex items-center justify-between px-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">YEARLY ACHIEVEMENT</span>
              <div className="text-3xl font-black text-white font-mono mt-1">
                {formatCurrency(fyMetrics.achievementValue)}
              </div>
              <p className="text-[11px] text-amber-400 font-bold mt-1">
                {fyMetrics.achievementPct}% Achieved
              </p>
            </div>
            <GaugeArc percentage={fyMetrics.achievementPct} colorClass="text-indigo-400" />
          </div>

          {/* Sub-cards Grid: Yearly Target | Remaining Target */}
          <div className="grid grid-cols-2 gap-3">
            {/* Yearly Target */}
            <div 
              onClick={() => openCardModal('yearlyTarget', 'Yearly Target', 'Annual Revenue Target Breakdown', <Target className="w-5 h-5 text-indigo-400" />)}
              className="bg-[#172033]/90 p-3 rounded-xl border border-indigo-500/30 cursor-pointer hover:border-indigo-400 transition-all group"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-300">Target</span>
              <div className="text-sm font-black text-white font-mono mt-1">{formatCurrency(fyMetrics.target)}</div>
              <div className="text-[10px] text-indigo-400/90 font-medium mt-0.5 truncate">Annual Goal</div>
            </div>

            {/* Remaining Target */}
            <div 
              onClick={() => openCardModal('revenueRemaining', 'Revenue Remaining', 'Revenue Achieved & Goal Gap Analysis', <Activity className="w-5 h-5 text-rose-400" />)}
              className="bg-[#172033]/90 p-3 rounded-xl border border-rose-500/30 cursor-pointer hover:border-rose-400 transition-all group"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-rose-300">Remaining</span>
              <div className="text-sm font-black text-rose-400 font-mono mt-1">
                {formatCurrency(fyMetrics.remainingTarget)}
              </div>
              <div className="text-[10px] text-rose-400/90 font-medium mt-0.5 truncate">Annual Gap</div>
            </div>
          </div>
        </div>

        {/* 2. MONTHLY PERFORMANCE COMPOUND CARD */}
        <div className="bg-[#0f172a]/95 backdrop-blur-md p-5 rounded-2xl border border-purple-500/30 relative overflow-hidden shadow-xl flex flex-col justify-between space-y-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                <PieChart className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-white tracking-wide uppercase">THIS MONTH</h4>
                <p className="text-[10px] text-slate-400 font-mono">August 2026 Monthly Target & Gap</p>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
              kpis.targetAchievementPct >= 80 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}>
              {kpis.targetAchievementPct >= 80 ? 'ON TRACK' : 'OFF TRACK'}
            </span>
          </div>

          {/* Hero Row: Achievement Value + Arc Gauge */}
          <div className="flex items-center justify-between px-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">MONTHLY ACHIEVEMENT</span>
              <div className="text-3xl font-black text-white font-mono mt-1">
                {formatCurrency(kpis.totalNetRevenue || kpis.totalGrossRevenue)}
              </div>
              <p className="text-[11px] text-amber-400 font-bold mt-1">
                {kpis.targetAchievementPct}% Achieved
              </p>
            </div>
            <GaugeArc percentage={kpis.targetAchievementPct} colorClass={kpis.targetAchievementPct >= 80 ? "text-emerald-400" : "text-rose-400"} />
          </div>

          {/* Sub-cards Grid: Monthly Target | Remaining Target */}
          <div className="grid grid-cols-2 gap-3">
            {/* Monthly Target */}
            <div 
              onClick={() => openCardModal('monthlyTarget', 'Monthly Target', 'Monthly Target Configuration & Breakdown', <Target className="w-5 h-5 text-purple-400" />)}
              className="bg-[#172033]/90 p-3 rounded-xl border border-purple-500/30 cursor-pointer hover:border-purple-400 transition-all group"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-purple-300">Target</span>
              <div className="text-sm font-black text-white font-mono mt-1">{formatCurrency(kpis.monthlyTarget)}</div>
              <div className="text-[10px] text-purple-400/90 font-medium mt-0.5 truncate">Monthly Goal</div>
            </div>

            {/* Remaining Target */}
            <div 
              onClick={() => openCardModal('revenueRemaining', 'Revenue Remaining', 'Revenue Achieved & Goal Gap Analysis', <Activity className="w-5 h-5 text-rose-400" />)}
              className="bg-[#172033]/90 p-3 rounded-xl border border-rose-500/30 cursor-pointer hover:border-rose-400 transition-all group"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-rose-300">Remaining</span>
              <div className="text-sm font-black text-rose-400 font-mono mt-1">{formatCurrency(kpis.revenueRemaining)}</div>
              <div className="text-[10px] text-rose-400/90 font-medium mt-0.5 truncate">Gap to Goal</div>
            </div>
          </div>
        </div>

        {/* 3. ACTIVE DEALS PIPELINE COMPOUND CARD (Count & Value in 1 box) */}
        <div className="bg-[#0f172a]/95 backdrop-blur-md p-5 rounded-2xl border border-sky-500/30 relative overflow-hidden shadow-xl flex flex-col justify-between space-y-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                <Layers className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-white tracking-wide uppercase">ACTIVE DEALS PIPELINE</h4>
                <p className="text-[10px] text-slate-400 font-mono">Open Pipeline Deals Summary</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
              PIPELINE HEALTH
            </span>
          </div>

          {/* Hero Row: Total Pipeline Value & Count Badge */}
          <div className="flex items-center justify-between px-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TOTAL OPEN PIPELINE VALUE</span>
              <div className="text-3xl font-black text-white font-mono mt-1">
                {formatCurrency(kpis.pipelineNetValue)}
              </div>
              <p className="text-[11px] text-sky-400 font-medium mt-1">
                <span className="font-bold text-white">{kpis.totalDealsInPipeline}</span> Active Open Deals in Pipeline
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex flex-col items-center justify-center text-center w-24 h-24">
              <Layers className="w-6 h-6 text-sky-400 mb-1" />
              <span className="text-lg font-black text-white font-mono">{kpis.totalDealsInPipeline}</span>
              <span className="text-[9px] text-sky-300 uppercase font-bold">Open Deals</span>
            </div>
          </div>

          {/* Sub-cards Grid: Pipeline Count | Pipeline Value | Avg Sales Cycle */}
          <div className="grid grid-cols-3 gap-3">
            {/* Total Deals Count */}
            <div 
              onClick={() => openCardModal('totalDealsInPipeline', 'Total Deals in Pipeline', 'All Active Open Pipeline Deals', <Layers className="w-5 h-5 text-sky-400" />)}
              className="bg-[#172033]/90 p-3 rounded-xl border border-sky-500/30 cursor-pointer hover:border-sky-400 transition-all group"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-sky-300">Pipeline Count</span>
              <div className="text-sm font-black text-white font-mono mt-1">{kpis.totalDealsInPipeline} <span className="text-xs font-normal text-slate-400">Deals</span></div>
              <div className="text-[10px] text-sky-400/90 font-medium mt-0.5 truncate">Active Open Deals</div>
            </div>

            {/* Total Deals Value */}
            <div 
              onClick={() => openCardModal('pipelineValue', 'Pipeline Value', 'In-Progress Open Pipeline Deals', <BarChart3 className="w-5 h-5 text-teal-400" />)}
              className="bg-[#172033]/90 p-3 rounded-xl border border-teal-500/30 cursor-pointer hover:border-teal-400 transition-all group"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-teal-300">Pipeline Value</span>
              <div className="text-sm font-black text-teal-400 font-mono mt-1">{formatCurrency(kpis.pipelineNetValue)}</div>
              <div className="text-[10px] text-teal-400/90 font-medium mt-0.5 truncate">Net Open Value</div>
            </div>

            {/* Avg Sales Cycle */}
            <div 
              onClick={() => openCardModal('avgSalesCycle', 'Avg Sales Cycle', 'Won Deals Closing Velocity & Days', <Clock className="w-5 h-5 text-amber-400" />)}
              className="bg-[#172033]/90 p-3 rounded-xl border border-amber-500/30 cursor-pointer hover:border-amber-400 transition-all group"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-amber-300">Sales Cycle</span>
              <div className="text-sm font-black text-white font-mono mt-1">{kpis.avgSalesCycleDays} <span className="text-xs font-normal text-slate-400">Days</span></div>
              <div className="text-[10px] text-amber-400/90 font-medium mt-0.5 truncate">Velocity to Close</div>
            </div>
          </div>
        </div>

        {/* 4. WIN & LOSS CONVERSION COMPOUND CARD (Count & Value for both Win & Loss) */}
        <div className="bg-[#0f172a]/95 backdrop-blur-md p-5 rounded-2xl border border-emerald-500/30 relative overflow-hidden shadow-xl flex flex-col justify-between space-y-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <CheckCircle className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-white tracking-wide uppercase">WIN & LOSS CONVERSION</h4>
                <p className="text-[10px] text-slate-400 font-mono">Closed Deals Performance & Ratios</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              CONVERSION RATIOS
            </span>
          </div>

          {/* Hero Row: Win Rate % + Gauge Arc */}
          <div className="flex items-center justify-between px-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">OVERALL WIN RATE</span>
              <div className="text-3xl font-black text-white font-mono mt-1">
                {kpis.winRatePct}%
              </div>
              <p className="text-[11px] text-emerald-400 font-medium mt-1">
                <span className="font-bold text-white">{kpis.totalWonCount} Won</span> vs <span className="font-bold text-rose-400">{kpis.totalLostCount} Lost</span> Deals
              </p>
            </div>
            <GaugeArc percentage={kpis.winRatePct} colorClass="text-emerald-400" />
          </div>

          {/* Sub-cards Grid: Win Rate (Count & Value) | Loss Rate (Count & Value) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Win Rate (Shows Count AND Value) */}
            <div 
              onClick={() => openCardModal('winRate', 'Win Rate %', 'Closed Deals (Won + Lost) Analysis', <CheckCircle className="w-5 h-5 text-emerald-400" />)}
              className="bg-[#172033]/90 p-3 rounded-xl border border-emerald-500/30 cursor-pointer hover:border-emerald-400 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">WIN RATE ({kpis.winRatePct}%)</span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-lg font-black text-white font-mono">{kpis.totalWonCount} <span className="text-xs font-normal text-slate-400">Won</span></span>
                <span className="text-xs font-bold text-emerald-400 font-mono">{formatCurrency(wonDealsValue)}</span>
              </div>
              <div className="text-[10px] text-emerald-400/90 font-medium mt-1 truncate">Won Deals Count & Value</div>
            </div>

            {/* Loss Rate (Shows Count AND Value) */}
            <div 
              onClick={() => openCardModal('lossRate', 'Loss Rate %', 'Lost Deals Breakdown', <ShieldAlert className="w-5 h-5 text-rose-400" />)}
              className="bg-[#172033]/90 p-3 rounded-xl border border-rose-500/30 cursor-pointer hover:border-rose-400 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">LOSS RATE ({kpis.lossRatePct}%)</span>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-lg font-black text-rose-400 font-mono">{kpis.totalLostCount} <span className="text-xs font-normal text-slate-400">Lost</span></span>
                <span className="text-xs font-bold text-rose-400 font-mono">{formatCurrency(lostDealsValue)}</span>
              </div>
              <div className="text-[10px] text-rose-400/90 font-medium mt-1 truncate">Lost Deals Count & Value</div>
            </div>
          </div>
        </div>

      </div>

      {/* Modal */}
      {activeModal && (
        <KPICardDetailModal
          isOpen={!!activeModal}
          onClose={() => setActiveModal(null)}
          metricKey={activeModal.metricKey}
          title={activeModal.title}
          subtitle={activeModal.subtitle}
          icon={activeModal.icon}
          kpis={kpis}
          records={records}
          allRecords={allRecords}
        />
      )}
    </div>
  );
};

