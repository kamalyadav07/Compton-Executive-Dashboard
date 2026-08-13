import React from 'react';
import type { DealRecord, GlobalFilterState, KPIMetrics } from '../../types/sales';
import { KPICardsGrid } from '../../components/kpis/KPICardsGrid';
import { ChartsDashboard } from '../../components/charts/ChartsDashboard';
import { Leaderboard } from '../../components/leaderboard/Leaderboard';

interface DealDashboardProps {
  filters: GlobalFilterState;
  onFilterChange: (filters: GlobalFilterState) => void;
  onResetFilters: () => void;
  allRecords: DealRecord[];
  filteredRecords: DealRecord[];
  kpis: KPIMetrics;
}

export const DealDashboard: React.FC<DealDashboardProps> = ({
  allRecords,
  filteredRecords,
  kpis,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <KPICardsGrid kpis={kpis} records={filteredRecords} allRecords={allRecords} />

      <ChartsDashboard 
        records={filteredRecords} 
        allRecords={allRecords}
        kpis={kpis} 
      />

      <Leaderboard records={filteredRecords} kpis={kpis} />
    </div>
  );
};

export default DealDashboard;
