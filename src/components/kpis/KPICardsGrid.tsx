import React, { useState, useMemo } from 'react';
import {
  Target,
  PieChart,
  Activity,
  CheckCircle,
  ShieldAlert,
  Clock,
  Zap,
  BarChart3,
  Layers,
  Trophy
} from 'lucide-react';
import type { KPIMetrics, DealRecord } from '../../types/sales';
import { KPICardDetailModal } from './KPICardDetailModal';
import { getFYBounds } from '../../engine/salesProjectionEngine';
import { INDIVIDUAL_REP_MONTHLY_TARGETS } from '../../config/salesTargets';

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

  // 3. Mini Target Achievement Leaderboard for 4 Key Reps (Ranked by % Descending)
  const miniLeaderboard = useMemo(() => {
    const repConfigs = [
      { name: 'Taniya Negi', matchKeywords: ['taniya'], target: INDIVIDUAL_REP_MONTHLY_TARGETS['Taniya Negi'] || 550000 },
      { name: 'Sandeep Vahi', matchKeywords: ['sandeep'], target: INDIVIDUAL_REP_MONTHLY_TARGETS['Sandeep Vahi'] || 3950000 },
      { name: 'Rohit Yadav', matchKeywords: ['rohit'], target: INDIVIDUAL_REP_MONTHLY_TARGETS['Rohit Yadav'] || 7500000 },
      { name: 'Jitesh Chander', matchKeywords: ['jitesh'], target: INDIVIDUAL_REP_MONTHLY_TARGETS['Jitesh Chander'] || 4000000 }
    ];

    const wonList = activeRecordsList.filter(r => r.type === 'won' || r.stage?.toLowerCase().includes('won'));

    const items = repConfigs.map(cfg => {
      const repWonDeals = wonList.filter(r => {
        const repName = (r.salesRep || '').toLowerCase();
        return cfg.matchKeywords.some(kw => repName.includes(kw));
      });

      const achieved = repWonDeals.reduce((sum, r) => sum + (r.netRevenue || r.grossRevenue || 0), 0);
      const pct = cfg.target > 0 ? (achieved / cfg.target) * 100 : 0;

      return {
        name: cfg.name,
        achieved,
        target: cfg.target,
        pct: Math.round(pct * 10) / 10
      };
    });

    // Rank #1 highest % to #4 lowest %
    return items.sort((a, b) => b.pct - a.pct);
  }, [activeRecordsList]);

  return (
    <div className="w-full mb-8 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Deal Dashboard</span>
        </h3>
      </div>

      {/* 4 Sales Persons Mini Target Achievement Leaderboard */}
      <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Trophy className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white tracking-wide uppercase">
              TARGET ACHIEVEMENT LEADERBOARD
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Ranked by Achievement %
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {miniLeaderboard.map((rep, index) => {
            const rankGradients = [
              'from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/30 hover:border-amber-500/60',
              'from-slate-300/10 via-slate-400/5 to-transparent border-slate-700/80 hover:border-slate-500',
              'from-amber-700/10 via-amber-800/5 to-transparent border-amber-700/30 hover:border-amber-600/50',
              'from-cyan-500/10 via-cyan-500/5 to-transparent border-slate-800 hover:border-cyan-500/40'
            ];
            const badgeStyles = [
              'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-lg shadow-amber-500/20',
              'bg-slate-300 text-slate-950 font-black',
              'bg-amber-700 text-white font-black',
              'bg-slate-800 text-slate-300 border border-slate-700'
            ];

            return (
              <div
                key={rep.name}
                className={`p-4 rounded-xl border bg-gradient-to-b ${rankGradients[index] || rankGradients[3]} transition-all duration-200 flex flex-col justify-between space-y-3 relative overflow-hidden group`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                    {rep.name}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${badgeStyles[index] || badgeStyles[3]}`}>
                    #{index + 1}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className={`text-2xl font-black font-mono tracking-tight ${rep.pct >= 100 ? 'text-emerald-400' : index === 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {rep.pct.toFixed(1)}%
                  </div>
                  <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    Target Achievement
                  </div>
                  
                  {/* Subtle Progress Bar */}
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80 mt-1">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        rep.pct >= 100 
                          ? 'bg-emerald-400' 
                          : index === 0 
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400' 
                          : 'bg-cyan-400'
                      }`}
                      style={{ width: `${Math.min(100, rep.pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* 1. YEARLY PERFORMANCE COMPOUND CARD */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                <Target className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white tracking-wide uppercase">ANNUAL DEAL PERFORMANCE</h4>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md border ${fyMetrics.achievementPct >= 80
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
              {fyMetrics.achievementPct >= 80 ? 'ON TRACK' : 'NEEDS PUSH'}
            </span>
          </div>

          {/* Hero Row: Achievement Value + Arc Gauge */}
          <div className="flex items-center justify-between px-1">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">YEARLY SALES ACHIEVEMENT</span>
              <div className="text-3xl font-black text-white font-mono mt-1">
                {formatCurrency(fyMetrics.achievementValue)}
              </div>
              <p className="text-xs text-amber-400 font-bold font-mono mt-1">
                {fyMetrics.achievementPct}% Achieved
              </p>
            </div>
            <GaugeArc percentage={fyMetrics.achievementPct} colorClass="text-blue-400" />
          </div>

          {/* Flat Column Breakdown: Target | Remaining */}
          <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800/80 pt-3 border-t border-slate-800/80">
            {/* Target Column */}
            <div
              onClick={() => openCardModal('yearlyTarget', 'Yearly Target', 'Annual Revenue Target Breakdown', <Target className="w-5 h-5 text-blue-400" />)}
              className="space-y-1 cursor-pointer group"
            >
              <span className="text-xs font-semibold text-slate-400 group-hover:text-blue-400 transition-colors">Target</span>
              <div className="text-xl font-black text-white font-mono">{formatCurrency(fyMetrics.target)}</div>
            </div>

            {/* Remaining Column */}
            <div
              onClick={() => openCardModal('revenueRemaining', 'Revenue Remaining', 'Revenue Achieved & Goal Gap Analysis', <Activity className="w-5 h-5 text-rose-400" />)}
              className="pl-4 space-y-1 cursor-pointer group"
            >
              <span className="text-xs font-semibold text-rose-400 group-hover:text-rose-300 transition-colors">Remaining</span>
              <div className="text-xl font-black text-rose-400 font-mono">{formatCurrency(fyMetrics.remainingTarget)}</div>
            </div>
          </div>
        </div>

        {/* 2. MONTHLY PERFORMANCE COMPOUND CARD */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                <PieChart className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white tracking-wide uppercase">THIS MONTH DEAL PERFORMANCE</h4>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md border ${kpis.targetAchievementPct >= 80
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
              {kpis.targetAchievementPct >= 80 ? 'ON TRACK' : 'OFF TRACK'}
            </span>
          </div>

          {/* Hero Row: Achievement Value + Arc Gauge */}
          <div className="flex items-center justify-between px-1">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">MONTHLY SALES ACHIEVEMENT</span>
              <div className="text-3xl font-black text-white font-mono mt-1">
                {formatCurrency(kpis.totalNetRevenue || kpis.totalGrossRevenue)}
              </div>
              <p className="text-xs text-amber-400 font-bold font-mono mt-1">
                {kpis.targetAchievementPct}% Achieved
              </p>
            </div>
            <GaugeArc percentage={kpis.targetAchievementPct} colorClass={kpis.targetAchievementPct >= 80 ? "text-emerald-400" : "text-rose-400"} />
          </div>

          {/* Flat Column Breakdown: Target | Remaining */}
          <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800/80 pt-3 border-t border-slate-800/80">
            {/* Target Column */}
            <div
              onClick={() => openCardModal('monthlyTarget', 'Monthly Target', 'Monthly Target Configuration & Breakdown', <Target className="w-5 h-5 text-purple-400" />)}
              className="space-y-1 cursor-pointer group"
            >
              <span className="text-xs font-semibold text-slate-400 group-hover:text-purple-400 transition-colors">Target</span>
              <div className="text-xl font-black text-white font-mono">{formatCurrency(kpis.monthlyTarget)}</div>
            </div>

            {/* Remaining Column */}
            <div
              onClick={() => openCardModal('revenueRemaining', 'Revenue Remaining', 'Revenue Achieved & Goal Gap Analysis', <Activity className="w-5 h-5 text-rose-400" />)}
              className="pl-4 space-y-1 cursor-pointer group"
            >
              <span className="text-xs font-semibold text-rose-400 group-hover:text-rose-300 transition-colors">Remaining</span>
              <div className="text-xl font-black text-rose-400 font-mono">{formatCurrency(kpis.revenueRemaining)}</div>
            </div>
          </div>
        </div>

        {/* 3. ACTIVE DEALS PIPELINE COMPOUND CARD */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white tracking-wide uppercase">ACTIVE DEALS PIPELINE</h4>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20">
              PIPELINE HEALTH
            </span>
          </div>

          {/* Flat Column Breakdown: Pipeline Count | Pipeline Value | Sales Cycle */}
          <div className="grid grid-cols-3 gap-4 divide-x divide-slate-800/80 pt-1">
            {/* Total Deals Count */}
            <div
              onClick={() => openCardModal('totalDealsInPipeline', 'Total Deals in Pipeline', 'All Active Open Pipeline Deals', <Layers className="w-5 h-5 text-sky-400" />)}
              className="space-y-1 cursor-pointer group"
            >
              <span className="text-xs font-semibold text-sky-400">Pipeline Count</span>
              <div className="text-2xl font-black text-white font-mono">{kpis.totalDealsInPipeline} <span className="text-xs font-semibold text-slate-400 font-sans">Deals</span></div>
            </div>

            {/* Total Deals Value */}
            <div
              onClick={() => openCardModal('pipelineValue', 'Pipeline Value', 'In-Progress Open Pipeline Deals', <BarChart3 className="w-5 h-5 text-teal-400" />)}
              className="pl-4 space-y-1 cursor-pointer group"
            >
              <span className="text-xs font-semibold text-teal-400">Pipeline Value</span>
              <div className="text-2xl font-black text-teal-400 font-mono">{formatCurrency(kpis.pipelineNetValue)}</div>
            </div>

            {/* Avg Sales Cycle */}
            <div
              onClick={() => openCardModal('avgSalesCycle', 'Avg Sales Cycle', 'Won Deals Closing Velocity & Days', <Clock className="w-5 h-5 text-amber-400" />)}
              className="pl-4 space-y-1 cursor-pointer group"
            >
              <span className="text-xs font-semibold text-amber-400">Sales Cycle</span>
              <div className="text-2xl font-black text-white font-mono">{kpis.avgSalesCycleDays} <span className="text-xs font-semibold text-slate-400 font-sans">Days</span></div>
            </div>
          </div>
        </div>

        {/* 4. WIN & LOSS CONVERSION COMPOUND CARD */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-white tracking-wide uppercase">WIN & LOSS CONVERSION</h4>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              CONVERSION RATIOS
            </span>
          </div>

          {/* Flat Column Breakdown: Win Rate | Loss Rate */}
          <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800/80 pt-1">
            {/* Win Rate */}
            <div
              onClick={() => openCardModal('winRate', 'Win Rate %', 'Closed Deals (Won + Lost) Analysis', <CheckCircle className="w-5 h-5 text-emerald-400" />)}
              className="space-y-1.5 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400">Win Rate ({kpis.winRatePct}%)</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white font-mono">{kpis.totalWonCount} <span className="text-xs font-semibold text-slate-400 font-sans">Won</span></span>
                <span className="text-sm font-bold text-emerald-400 font-mono">{formatCurrency(wonDealsValue)}</span>
              </div>
            </div>

            {/* Loss Rate */}
            <div
              onClick={() => openCardModal('lossRate', 'Loss Rate %', 'Lost Deals Breakdown', <ShieldAlert className="w-5 h-5 text-rose-400" />)}
              className="pl-4 space-y-1.5 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-400">Loss Rate ({kpis.lossRatePct}%)</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-rose-400 font-mono">{kpis.totalLostCount} <span className="text-xs font-semibold text-slate-400 font-sans">Lost</span></span>
                <span className="text-sm font-bold text-rose-400 font-mono">{formatCurrency(lostDealsValue)}</span>
              </div>
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

