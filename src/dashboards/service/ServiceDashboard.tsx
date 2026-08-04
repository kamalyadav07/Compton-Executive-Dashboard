import React from 'react';
import { Headphones, Clock } from 'lucide-react';

export const ServiceDashboard: React.FC = () => {
  return (
    <div className="glass-panel p-8 rounded-2xl border border-[var(--border-color)] text-center space-y-4 my-8 max-w-2xl mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/30">
        <Headphones className="w-7 h-7" />
      </div>
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">Service Dashboard</h2>
      <p className="text-sm text-[var(--text-secondary)]">
        This dashboard module is reserved for customer service tickets, SLA resolution rates, and CSAT scores.
      </p>
      <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
        <Clock className="w-3.5 h-3.5" />
        <span>Module Configured & Ready for Development</span>
      </div>
    </div>
  );
};

export default ServiceDashboard;
