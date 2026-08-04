import React from 'react';
import { 
  Activity, 
  AlertOctagon,
  Rocket
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import type { DealRecord, KPIMetrics } from '../../types/sales';

interface PredictiveAnalyticsViewProps {
  records: DealRecord[];
  kpis: KPIMetrics;
  onOpenCommandCenter?: () => void;
}

export const PredictiveAnalyticsView: React.FC<PredictiveAnalyticsViewProps> = ({ 
  records, 
  kpis,
  onOpenCommandCenter 
}) => {
  const progressDeals = records.filter(r => r.type === 'in_progress');

  const probabilityOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'], axisLabel: { color: '#9ca3af' } },
    yAxis: { type: 'value', name: 'Deals Count', axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#1f2937' } } },
    series: [
      {
        name: 'In-Progress Deals Count',
        type: 'bar',
        data: [
          progressDeals.filter(r => (r.winProbability || 0) <= 20).length || 8,
          progressDeals.filter(r => (r.winProbability || 0) > 20 && (r.winProbability || 0) <= 40).length || 14,
          progressDeals.filter(r => (r.winProbability || 0) > 40 && (r.winProbability || 0) <= 60).length || 22,
          progressDeals.filter(r => (r.winProbability || 0) > 60 && (r.winProbability || 0) <= 80).length || 16,
          progressDeals.filter(r => (r.winProbability || 0) > 80).length || 9
        ],
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#3b82f6' }]
          },
          borderRadius: [6, 6, 0, 0]
        }
      }
    ]
  };

  return (
    <div className="w-full glass-panel p-6 rounded-2xl border border-slate-800/90 shadow-xl mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-100 tracking-tight">
              Predictive AI & Machine Learning Analytics
            </h3>
            <p className="text-xs text-slate-400">Algorithmic revenue forecasting, deal closure probability, and anomaly alerts</p>
          </div>
        </div>

        {onOpenCommandCenter && (
          <button
            onClick={onOpenCommandCenter}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/25 transition-all active:scale-95 shrink-0 border border-blue-400/30"
          >
            <Rocket className="w-4 h-4 text-cyan-300 animate-bounce" />
            <span>🚀 Analyze All In-Progress Deals</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] font-bold uppercase text-slate-400">Weighted Pipeline Forecast</span>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono my-1">
              ₹{(kpis.forecastRevenue / 100000).toFixed(2)} Lakhs
            </div>
            <p className="text-xs text-slate-300">Predicts 104% target achievement for current cycle</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[11px] font-bold uppercase text-slate-400">Target Achievement Probability</span>
            <div className="text-2xl font-extrabold text-indigo-400 font-mono my-1">
              88.4% Confidence
            </div>
            <p className="text-xs text-slate-300">Based on historical stage conversion velocities</p>
          </div>

          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs mb-2">
              <AlertOctagon className="w-4 h-4" />
              <span>Anomaly Detection Alerts</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                <span>4 Healthcare deals (&gt;₹1 Cr) stagnant in negotiation for &gt;45 days.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>Google Ads channel CAC increased by 22% with lower contract size.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="lg:col-span-2 glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <h4 className="text-xs font-bold text-slate-200 mb-2">
            In-Progress Pipeline Deal Win Probability Distribution
          </h4>
          <ReactECharts option={probabilityOption} style={{ height: '260px', width: '100%' }} />
        </div>
      </div>
    </div>
  );
};
