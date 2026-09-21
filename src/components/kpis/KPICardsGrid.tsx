import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  PieChart,
  CheckCircle,
  ShieldAlert,
  Clock,
  BarChart3,
  Layers,
  Trophy
} from 'lucide-react';
import type { KPIMetrics, DealRecord } from '../../types/sales';
import { KPICardDetailModal } from './KPICardDetailModal';
import { getFYBounds } from '../../engine/salesProjectionEngine';
import { 
  getCompanyYearlyTarget, 
  getIndividualRepMonthlyTargets 
} from '../../config/salesTargets';

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
    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
      <svg className="w-full h-full transform -rotate-135" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke="currentColor"
          strokeWidth="8"
          className="text-slate-800 fill-none"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke="currentColor"
          strokeWidth="8"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`${colorClass} fill-none transition-all duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-bold text-white font-mono tracking-tight">{clamped.toFixed(0)}%</span>
        <span className="text-[10px] text-slate-400 font-medium">of target</span>
      </div>
    </div>
  );
};

export const KPICardsGrid: React.FC<KPICardsGridProps> = ({ kpis, records = [], allRecords = [] }) => {
  const [activeModal, setActiveModal] = useState<ActiveModalState | null>(null);
  const [targetsVersion, setTargetsVersion] = useState<number>(0);

  useEffect(() => {
    const handleTargetsUpdated = () => {
      setTargetsVersion(v => v + 1);
    };
    window.addEventListener('salesTargetsUpdated', handleTargetsUpdated);
    return () => window.removeEventListener('salesTargetsUpdated', handleTargetsUpdated);
  }, []);

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

    const achievementValue = fyWonList.reduce((acc, r) => acc + (r.netRevenue ?? r.grossRevenue ?? 0), 0);
    const target = (kpis.yearlyTarget && kpis.yearlyTarget !== 200000000)
      ? kpis.yearlyTarget
      : getCompanyYearlyTarget();
    const achievementPct = target > 0 ? Math.round((achievementValue / target) * 1000) / 10 : 0;
    const remainingTarget = Math.max(0, target - achievementValue);

    return {
      target,
      achievementValue,
      achievementPct,
      remainingTarget
    };
  }, [allRecords, activeRecordsList, kpis.yearlyTarget, targetsVersion]);

  // 2. Won & Lost Deals Values for Conversion Box
  const wonDealsValue = useMemo(() => {
    const wonList = activeRecordsList.filter(r => r.type === 'won' || r.stage?.toLowerCase().includes('won'));
    if (wonList.length > 0) {
      return wonList.reduce((acc, r) => acc + (r.netRevenue ?? r.grossRevenue ?? 0), 0);
    }
    return kpis.totalNetRevenue;
  }, [activeRecordsList, kpis.totalNetRevenue]);

  const lostDealsValue = useMemo(() => {
    const lostList = activeRecordsList.filter(r => r.type === 'lost' || r.stage?.toLowerCase().includes('lost'));
    return lostList.reduce((acc, r) => acc + (r.netRevenue ?? r.grossRevenue ?? 0), 0);
  }, [activeRecordsList]);

  // 3. Mini Target Achievement Leaderboard for Key Reps (Ranked by % Descending)
  const miniLeaderboard = useMemo(() => {
    const currentRepTargets = getIndividualRepMonthlyTargets();
    const repConfigs = Object.entries(currentRepTargets).map(([name, target]) => {
      const firstWord = name.toLowerCase().split(' ')[0];
      return {
        name,
        matchKeywords: [firstWord, name.toLowerCase()],
        target
      };
    });

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

    // Rank #1 highest % to lowest %
    return items.sort((a, b) => b.pct - a.pct);
  }, [activeRecordsList, targetsVersion]);

  return (
    <div className="w-full mb-8 space-y-5">


      {/* 4 Sales Persons Mini Target Achievement Leaderboard */}
      <div className="bg-[#0f172a]/90 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Sales Target Achievement
              </h3>
              <p className="text-xs text-slate-400">Monthly Performance by Key Representative</p>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            Ranked by Achievement %
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {miniLeaderboard.map((rep, index) => {
            return (
              <div
                key={rep.name}
                className="p-4 rounded-xl border border-slate-800/90 bg-slate-900/60 hover:border-slate-700/80 transition-all duration-200 flex flex-col justify-between space-y-3 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                    {rep.name}
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono font-medium ${
                    index === 0
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : index === 1
                      ? 'bg-slate-400/15 text-slate-200 border border-slate-400/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    #{index + 1}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className={`text-2xl font-bold font-mono tracking-tight ${rep.pct >= 100 ? 'text-emerald-400' : index === 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {rep.pct.toFixed(1)}%
                  </div>
                  
                  {/* Subtle Progress Bar */}
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mt-1">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        rep.pct >= 100 
                          ? 'bg-emerald-400' 
                          : index === 0 
                          ? 'bg-amber-400' 
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
              <h4 className="text-sm font-semibold text-white tracking-tight">Annual Deal Performance</h4>
            </div>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${fyMetrics.achievementPct >= 80
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
              {fyMetrics.achievementPct >= 80 ? 'On Track' : 'Needs Push'}
            </span>
          </div>

          {/* Hero Row: Achievement Value + Arc Gauge */}
          <div
            onClick={() => openCardModal('yearlyAchievement', 'Yearly Deal Closure Value', 'Annual Closed Won Deals Breakdown', <Target className="w-5 h-5 text-blue-400" />)}
            className="flex items-center justify-between px-1 cursor-pointer group"
          >
            <div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-blue-400 transition-colors">Yearly Closed Deals Value</span>
              <div className="text-3xl font-bold text-white font-mono mt-1 tracking-tight">
                {formatCurrency(fyMetrics.achievementValue)}
              </div>
              <p className="text-xs text-amber-400 font-semibold font-mono mt-1">
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
              <span className="text-xs font-medium text-slate-400 group-hover:text-blue-400 transition-colors">Target Value</span>
              <div className="text-xl font-bold text-white font-mono">{formatCurrency(fyMetrics.target)}</div>
            </div>

            {/* Remaining Column */}
            <div className="pl-4 space-y-1">
              <span className="text-xs font-medium text-rose-400">Remaining Gap</span>
              <div className="text-xl font-bold text-rose-400 font-mono">{formatCurrency(fyMetrics.remainingTarget)}</div>
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
              <h4 className="text-sm font-semibold text-white tracking-tight">Monthly Deal Performance</h4>
            </div>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${kpis.targetAchievementPct >= 80
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
              {kpis.targetAchievementPct >= 80 ? 'On Track' : 'Off Track'}
            </span>
          </div>

          {/* Hero Row: Achievement Value + Arc Gauge */}
          <div
            onClick={() => openCardModal('monthlyAchievement', 'Monthly Deal Closure Value', 'Monthly Closed Won Deals Breakdown', <PieChart className="w-5 h-5 text-cyan-400" />)}
            className="flex items-center justify-between px-1 cursor-pointer group"
          >
            <div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-cyan-400 transition-colors">Monthly Closed Deals Value</span>
              <div className="text-3xl font-bold text-white font-mono mt-1 tracking-tight">
                {formatCurrency(kpis.totalNetRevenue || kpis.totalGrossRevenue)}
              </div>
              <p className="text-xs text-amber-400 font-semibold font-mono mt-1">
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
              <span className="text-xs font-medium text-slate-400 group-hover:text-purple-400 transition-colors">Target Value</span>
              <div className="text-xl font-bold text-white font-mono">{formatCurrency(kpis.monthlyTarget)}</div>
            </div>

            {/* Remaining Column */}
            <div className="pl-4 space-y-1">
              <span className="text-xs font-medium text-rose-400">Remaining Gap</span>
              <div className="text-xl font-bold text-rose-400 font-mono">{formatCurrency(kpis.revenueRemaining)}</div>
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
              <h4 className="text-sm font-semibold text-white tracking-tight">Active Deals Pipeline</h4>
            </div>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
              Pipeline Health
            </span>
          </div>

          {/* Flat Column Breakdown: Pipeline Count | Pipeline Value | Sales Cycle */}
          <div className="grid grid-cols-3 gap-4 divide-x divide-slate-800/80 pt-1">
            {/* Total Deals Count */}
            <div
              onClick={() => openCardModal('totalDealsInPipeline', 'Total Deals in Pipeline', 'All Active Open Pipeline Deals', <Layers className="w-5 h-5 text-sky-400" />)}
              className="space-y-1 cursor-pointer group"
            >
              <span className="text-xs font-medium text-sky-400">Deals in Pipeline</span>
              <div className="text-2xl font-bold text-white font-mono">{kpis.totalDealsInPipeline} <span className="text-xs font-normal text-slate-400 font-sans">deals</span></div>
            </div>

            {/* Total Deals Value */}
            <div
              onClick={() => openCardModal('pipelineValue', 'Pipeline Value', 'In-Progress Open Pipeline Deals', <BarChart3 className="w-5 h-5 text-teal-400" />)}
              className="pl-4 space-y-1 cursor-pointer group"
            >
              <span className="text-xs font-medium text-teal-400">Pipeline Value</span>
              <div className="text-2xl font-bold text-teal-400 font-mono">{formatCurrency(kpis.pipelineNetValue)}</div>
            </div>

            {/* Avg Deal Cycle */}
            <div
              onClick={() => openCardModal('avgSalesCycle', 'Avg Deal Cycle', 'Won Deals Closing Velocity & Days', <Clock className="w-5 h-5 text-amber-400" />)}
              className="pl-4 space-y-1 cursor-pointer group"
            >
              <span className="text-xs font-medium text-amber-400">Avg Sales Cycle</span>
              <div className="text-2xl font-bold text-white font-mono">{kpis.avgSalesCycleDays} <span className="text-xs font-normal text-slate-400 font-sans">days</span></div>
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
              <h4 className="text-sm font-semibold text-white tracking-tight">Conversion & Win Rate</h4>
            </div>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Win / Loss Ratio
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
                <span className="text-xs font-medium text-emerald-400">Win Rate ({kpis.winRatePct}%)</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white font-mono">{kpis.totalWonCount} <span className="text-xs font-normal text-slate-400 font-sans">Won</span></span>
                <span className="text-sm font-semibold text-emerald-400 font-mono">{formatCurrency(wonDealsValue)}</span>
              </div>
            </div>

            {/* Loss Rate */}
            <div
              onClick={() => openCardModal('lossRate', 'Loss Rate %', 'Lost Deals Breakdown', <ShieldAlert className="w-5 h-5 text-rose-400" />)}
              className="pl-4 space-y-1.5 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-rose-400">Loss Rate ({kpis.lossRatePct}%)</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-rose-400 font-mono">{kpis.totalLostCount} <span className="text-xs font-normal text-slate-400 font-sans">Lost</span></span>
                <span className="text-sm font-semibold text-rose-400 font-mono">{formatCurrency(lostDealsValue)}</span>
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

