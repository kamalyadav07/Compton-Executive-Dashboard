import React from 'react';
import { 
  Lightbulb
} from 'lucide-react';
import type { SmartRecommendation } from '../../types/sales';

interface SmartRecommendationsViewProps {
  recommendations: SmartRecommendation[];
}

export const SmartRecommendationsView: React.FC<SmartRecommendationsViewProps> = ({ recommendations }) => {
  return (
    <div className="w-full glass-panel p-6 rounded-2xl border border-slate-800/90 shadow-xl mb-8">
      <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-800/80">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Lightbulb className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-100 tracking-tight">
            Gemini Smart Action Recommendations
          </h3>
          <p className="text-xs text-slate-400">Prioritized strategic interventions to maximize revenue velocity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <PriorityColumn
          priority="High"
          color="rose"
          items={recommendations.filter(r => r.priority === 'High')}
        />

        <PriorityColumn
          priority="Medium"
          color="amber"
          items={recommendations.filter(r => r.priority === 'Medium')}
        />

        <PriorityColumn
          priority="Low"
          color="blue"
          items={recommendations.filter(r => r.priority === 'Low')}
        />
      </div>
    </div>
  );
};

interface PriorityColumnProps {
  priority: 'High' | 'Medium' | 'Low';
  color: 'rose' | 'amber' | 'blue';
  items: SmartRecommendation[];
}

const PriorityColumn: React.FC<PriorityColumnProps> = ({ priority, color, items }) => {
  const badgeStyles = {
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
  }[color];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
        <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase border ${badgeStyles}`}>
          {priority} Priority Actions ({items.length})
        </span>
      </div>

      <div className="space-y-3">
        {items.map(rec => (
          <div key={rec.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all">
            <div className="flex items-start justify-between mb-1.5">
              <h4 className="text-xs font-bold text-slate-100">{rec.title}</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-normal mb-3">
              {rec.description}
            </p>
            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/60">
              <span className="text-slate-400 font-medium">{rec.impactArea}</span>
              {rec.estimatedRevenueImpact && (
                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {rec.estimatedRevenueImpact}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
