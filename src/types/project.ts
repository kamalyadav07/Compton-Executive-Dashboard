export type ProjectStatus = 'Running' | 'Completed' | 'Delayed' | 'On Hold' | 'Planning';
export type TimelineStatus = 'On Time' | 'Delayed';
export type BudgetStatus = 'Under Budget' | 'On Budget' | 'Over Budget';

export interface ProjectRecord {
  id: string;
  sNo: number | string;
  customerName: string;
  projectName: string;
  status: ProjectStatus;
  projectType: string;
  startDate: string;
  plannedEndDate: string;
  actualEndDate: string;
  plannedBudget: number;
  actualCost: number;
  
  // Calculated & Derived Analytics
  timelineStatus: TimelineStatus;
  budgetStatus: BudgetStatus;
  budgetVariance: number; // actualCost - plannedBudget
  budgetVariancePct: number; // ((actualCost - plannedBudget) / plannedBudget) * 100
  delayDays: number; // >0 if delayed
  rawRecord?: Record<string, any>;
}

export interface ProjectFilterState {
  searchQuery: string;
  status: string; // 'All' | 'Running' | 'Completed' | 'On Hold' | 'Planning'
  timelineStatus: string; // 'All' | 'On Time' | 'Delayed'
  budgetStatus: string; // 'All' | 'Under Budget' | 'On Budget' | 'Over Budget'
  projectType: string; // 'All' | 'CCTV' | 'Networking' | ...
  customer: string; // 'All' | specific customer
  dateFilter: string; // 'All Dates' | 'July 2026' | 'August 2026' | etc.
}

export interface ProjectKPIMetrics {
  totalProjects: number;
  projectsRunning: number;
  // Running-only breakdown (for top cards)
  onTimeProjects: number;
  delayedProjects: number;
  underBudgetProjects: number;
  overBudgetProjects: number;
  onBudgetProjects: number;
  // Complete portfolio-wide breakdown (for donut charts)
  portfolioOnTimeProjects: number;
  portfolioDelayedProjects: number;
  portfolioUnderBudgetProjects: number;
  portfolioOverBudgetProjects: number;
  portfolioOnBudgetProjects: number;
  totalPlannedBudget: number;
  totalActualCost: number;
  netBudgetVariance: number; // totalActualCost - totalPlannedBudget
  onTimeRatePct: number;
  underBudgetRatePct: number;
  avgCostPerProject: number;
}
