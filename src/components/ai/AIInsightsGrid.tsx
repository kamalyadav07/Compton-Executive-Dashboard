import React, { useState } from 'react';
import { 
  Sparkles, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2
} from 'lucide-react';
import type { AIInsightItem } from '../../types/sales';

interface AIInsightsGridProps {
  insights: AIInsightItem[];
}

export const AIInsightsGrid: React.FC<AIInsightsGridProps> = ({ insights }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All 20+ Insights' },
    { id: 'revenue', label: 'Revenue & Growth' },
    { id: 'lead_source', label: 'Lead Sources & ROI' },
    { id: 'pricing', label: 'Pricing & Friction' },
    { id: 'pipeline', label: 'Pipeline & Sales Cycle' },
    { id: 'sales_rep', label: 'Sales Team' },
  ];

  const filtered = selectedCategory === 'all' 
    ? insights 
    : insights.filter(i => i.category === selectedCategory);

  return (
    <div className="w-full glass-panel p-6 rounded-2xl border border-slate-800/90 shadow-xl mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-extrabold text-slate-100 tracking-tight">
              Gemini Automated Business Insights (20+ Items)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deep algorithmic pattern detection over uploaded deal records
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <InsightCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};

const InsightCard: React.FC<{ item: AIInsightItem }> = ({ item }) => {
  const badgeStyles = {
    positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    critical: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    neutral: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
  }[item.type];

  const iconMap = {
    positive: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    critical: <ShieldAlert className="w-4 h-4 text-rose-400" />,
    neutral: <Sparkles className="w-4 h-4 text-blue-400" />
  }[item.type];

  return (
    <div className="glass-panel glass-panel-hover p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            {iconMap}
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {item.category.replace('_', ' ')}
            </span>
          </div>
          {item.metric && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeStyles}`}>
              {item.metric}
            </span>
          )}
        </div>

        <h4 className="text-xs font-bold text-slate-100 mb-1.5 leading-snug">
          {item.title}
        </h4>
        <p className="text-xs text-slate-300 leading-relaxed font-normal mb-3">
          {item.description}
        </p>
      </div>

      {item.actionableStep && (
        <div className="pt-2 border-t border-slate-800/60 text-[11px] text-indigo-300 font-medium flex items-center gap-1.5">
          <span className="font-bold text-slate-400">Action:</span>
          <span>{item.actionableStep}</span>
        </div>
      )}
    </div>
  );
};
