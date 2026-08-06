import React from 'react';
import { 
  Award, 
  Target, 
  PieChart, 
  Activity, 
  CheckCircle, 
  ShieldAlert, 
  Clock, 
  TrendingUp, 
  Zap 
} from 'lucide-react';
import type { KPIMetrics } from '../../types/sales';

interface KPICardsGridProps {
  kpis: KPIMetrics;
}

const formatCurrency = (val: number): string => {
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  } else if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)} L`;
  }
  return `₹${val.toLocaleString('en-IN')}`;
};

export const KPICardsGrid: React.FC<KPICardsGridProps> = ({ kpis }) => {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Key Performance Indicators</span>
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 lg:gap-6">
        {/* 1. Total Revenue (Income) */}
        <KPICard
          title="Total Revenue (Income)"
          value={formatCurrency(kpis.totalNetRevenue)}
          subtitle="Total Closed Revenue"
          icon={<Award className="w-5 h-5 text-emerald-400" />}
          gradient="from-emerald-500/15 to-teal-500/15"
          borderColor="border-emerald-500/40"
          trend={kpis.totalNetRevenue > 0 ? `${kpis.revenueGrowthPct >= 0 ? '+' : ''}${kpis.revenueGrowthPct}% MoM` : undefined}
          trendPositive={kpis.revenueGrowthPct >= 0}
          highlight={true}
        />

        {/* 2. Monthly Target */}
        <KPICard
          title="Target / Goal"
          value={formatCurrency(kpis.monthlyTarget)}
          subtitle={`Sales Goal (${formatCurrency(kpis.monthlyTarget)})`}
          icon={<Target className="w-5 h-5 text-indigo-400" />}
          gradient="from-indigo-500/10 to-purple-500/10"
          borderColor="border-indigo-500/30"
        />

        {/* 3. Target Achievement */}
        <KPICard
          title="Target Achievement"
          value={`${kpis.targetAchievementPct}%`}
          subtitle={`Revenue vs ${formatCurrency(kpis.monthlyTarget)} Goal`}
          icon={<PieChart className="w-5 h-5 text-amber-400" />}
          gradient="from-amber-500/15 to-orange-500/15"
          borderColor="border-amber-500/40"
          trend={kpis.totalGrossRevenue > 0 ? (kpis.targetAchievementPct >= 80 ? 'On Track' : 'Needs Push') : undefined}
          trendPositive={kpis.targetAchievementPct >= 80}
        />

        {/* 4. Revenue Remaining */}
        <KPICard
          title="Revenue Remaining"
          value={formatCurrency(kpis.revenueRemaining)}
          subtitle={`Gap to ${formatCurrency(kpis.monthlyTarget)} Goal`}
          icon={<Activity className="w-5 h-5 text-rose-400" />}
          gradient="from-rose-500/10 to-pink-500/10"
          borderColor="border-rose-500/30"
        />



        {/* 9. Win Rate % (Value-Based) */}
        <KPICard
          title="Win Rate %"
          value={`${kpis.winRatePct}%`}
          subtitle="Won Value / Total Closed Value"
          icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
          gradient="from-emerald-500/15 to-teal-500/15"
          borderColor="border-emerald-500/40"
        />

        {/* 10. Loss Rate % (Value-Based) */}
        <KPICard
          title="Loss Rate %"
          value={`${kpis.lossRatePct}%`}
          subtitle="Lost Value / Total Closed Value"
          icon={<ShieldAlert className="w-5 h-5 text-rose-400" />}
          gradient="from-rose-500/10 to-pink-500/10"
          borderColor="border-rose-500/30"
        />

        {/* 11. Avg Sales Cycle */}
        <KPICard
          title="Avg Sales Cycle"
          value={`${kpis.avgSalesCycleDays} Days`}
          subtitle="Lead to won closing speed"
          icon={<Clock className="w-5 h-5 text-amber-400" />}
          gradient="from-amber-500/10 to-orange-500/10"
          borderColor="border-amber-500/30"
          trend={kpis.totalWonCount > 0 ? (kpis.salesCycleTrend || undefined) : undefined}
          trendPositive={kpis.salesCycleTrendPositive ?? true}
        />

        {/* 12. Revenue Growth */}
        <KPICard
          title="Revenue Growth"
          value={`${kpis.revenueGrowthPct >= 0 ? '+' : ''}${kpis.revenueGrowthPct}%`}
          subtitle="Growth trajectory"
          icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
          gradient={kpis.revenueGrowthPct >= 0 ? "from-emerald-500/10 to-green-500/10" : "from-rose-500/10 to-red-500/10"}
          borderColor={kpis.revenueGrowthPct >= 0 ? "border-emerald-500/30" : "border-rose-500/30"}
          trend={kpis.totalGrossRevenue > 0 ? (kpis.revenueGrowthPct >= 0 ? "MoM Expansion" : "MoM Contraction") : undefined}
          trendPositive={kpis.revenueGrowthPct >= 0}
        />
      </div>
    </div>
  );
};

interface KPICardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  borderColor: string;
  trend?: string;
  trendPositive?: boolean;
  highlight?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon,
  gradient,
  borderColor,
  trend,
  trendPositive = true,
  highlight = false
}) => {
  return (
    <div
      className={`glass-panel glass-panel-hover p-4 rounded-2xl border ${borderColor} bg-gradient-to-br ${gradient} flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
        highlight ? 'ring-2 ring-blue-500/40 glow-blue' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
          {title}
        </span>
        <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-700/60 shadow-inner">
          {icon}
        </div>
      </div>

      <div>
        <div className="text-xl font-extrabold text-slate-100 tracking-tight my-1 font-mono">
          {value}
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>
          {trend && (
            <span
              className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                trendPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
