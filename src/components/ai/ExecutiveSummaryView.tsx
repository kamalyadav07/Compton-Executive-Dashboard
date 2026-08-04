import React from 'react';
import { 
  FileText, 
  TrendingUp, 
  ShieldAlert, 
  Sparkles, 
  Award, 
  Target, 
  ArrowUpRight 
} from 'lucide-react';
import type { ExecutiveSummaryReport } from '../../types/sales';

interface ExecutiveSummaryViewProps {
  summary: ExecutiveSummaryReport;
}

export const ExecutiveSummaryView: React.FC<ExecutiveSummaryViewProps> = ({ summary }) => {
  return (
    <div className="w-full glass-panel p-6 rounded-2xl border border-slate-800/90 shadow-xl mb-8">
      <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-800/80">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            <span>Gemini AI Executive Summary & Briefing</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Auto-Generated from Excel Data
            </span>
          </h3>
          <p className="text-xs text-slate-400">Synthesized business performance overview for Board & Director review</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <SummaryCard
          title="Business Performance Summary"
          text={summary.businessSummary}
          icon={<FileText className="w-4 h-4 text-blue-400" />}
          borderColor="border-blue-500/30"
        />

        <SummaryCard
          title="Revenue & Net Cash Flow"
          text={summary.revenueSummary}
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          borderColor="border-emerald-500/30"
        />

        <SummaryCard
          title="Growth & Trajectory"
          text={summary.growthSummary}
          icon={<ArrowUpRight className="w-4 h-4 text-indigo-400" />}
          borderColor="border-indigo-500/30"
        />

        <SummaryCard
          title="Sales Team & Velocity"
          text={summary.teamSummary}
          icon={<Award className="w-4 h-4 text-amber-400" />}
          borderColor="border-amber-500/30"
        />

        <SummaryCard
          title="Friction & Business Risks"
          text={summary.riskSummary}
          icon={<ShieldAlert className="w-4 h-4 text-rose-400" />}
          borderColor="border-rose-500/30"
        />

        <SummaryCard
          title="Strategic Opportunities"
          text={summary.opportunitySummary}
          icon={<Target className="w-4 h-4 text-purple-400" />}
          borderColor="border-purple-500/30"
        />
      </div>

      <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400 block text-[11px]">Top Performer</span>
          <span className="text-emerald-400 font-extrabold text-xs truncate block">{summary.topPerformer}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400 block text-[11px]">Most Profitable Sector</span>
          <span className="text-blue-400 font-extrabold text-xs truncate block">{summary.mostProfitableIndustry}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400 block text-[11px]">Most Profitable Solution</span>
          <span className="text-purple-400 font-extrabold text-xs truncate block">{summary.mostProfitableSolution}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-slate-400 block text-[11px]">Pipeline Coverage Health</span>
          <span className="text-amber-400 font-extrabold text-xs truncate block">{summary.pipelineHealth}</span>
        </div>
      </div>
    </div>
  );
};

interface SummaryCardProps {
  title: string;
  text: string;
  icon: React.ReactNode;
  borderColor: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, text, icon, borderColor }) => {
  return (
    <div className={`p-4 rounded-xl bg-slate-900/50 border ${borderColor} flex flex-col justify-between hover:bg-slate-900/80 transition-colors`}>
      <div className="flex items-center space-x-2.5 mb-2">
        <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700">
          {icon}
        </div>
        <h4 className="text-xs font-bold text-slate-200">{title}</h4>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed font-normal">{text}</p>
    </div>
  );
};
