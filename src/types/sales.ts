export type DealType = 'won' | 'lost' | 'in_progress';

export interface DealRecord {
  id: string;
  customer: string;
  grossRevenue: number;
  gstAmount: number;
  netRevenue: number;
  salesRep: string;
  industry: string;
  solution: string;
  leadSource: string;
  stage: string;
  date: string; // YYYY-MM-DD
  monthYear: string; // e.g. "2025-05" or "May 2025"
  year: number;
  quarter: string; // e.g. "Q2 2025"
  type: DealType;
  lostReason?: string;
  winningCompetitor?: string;
  winProbability?: number; // 0-100
  salesCycleDays?: number;
  contractTermMonths?: number;
  marginPct?: number;
  comments?: string;
  remarks?: string;
  fileAttachments?: { id?: string; showUrl?: string; downloadUrl?: string }[];
  rawRecord?: Record<string, any>;
}



export interface GlobalFilterState {
  startDate: string;
  endDate: string;
  selectedMonth: string;
  selectedQuarter: string;
  selectedYear: string;
  salesRep: string;
  industry: string;
  solution: string;
  leadSource: string;
  customerQuery: string;
  dealQuery: string;
  companyQuery: string;
  minDealValue: number;
  maxDealValue: number;
  pipelineStage: string;
}

export interface KPIMetrics {
  totalGrossRevenue: number;
  totalNetRevenue: number;
  monthlyTarget: number;
  yearlyTarget: number;
  targetAchievementPct: number;
  yearlyAchievementPct: number;
  revenueRemaining: number;
  totalWonCount: number;
  totalLostCount: number;
  totalDealsInPipeline: number;
  pipelineGrossValue: number;
  pipelineNetValue: number;
  forecastRevenue: number;
  avgDealSize: number;
  largestDealSize: number;
  medianDealSize: number;
  winRatePct: number;
  lossRatePct: number;
  pipelineCoverageRatio: number;
  avgSalesCycleDays: number;
  salesCycleTrend?: string;
  salesCycleTrendPositive?: boolean;
  revenueGrowthPct: number;
  forecastAchievementPct: number;
  leadConversionRatePct: number;
}

export interface SalesRepMetric {
  rank: number;
  name: string;
  avatar: string;
  grossRevenue: number;
  netRevenue: number;
  wonCount: number;
  lostCount: number;
  pipelineValue: number;
  avgDealSize: number;
  largestDeal: number;
  revenueGrowthPct: number;
  contributionPct: number;
  targetPct: number;
  winRatePct: number;
  lossRatePct: number;
  medal: 'gold' | 'silver' | 'bronze' | null;
}

export interface AIInsightItem {
  id: string;
  category: 'revenue' | 'lead_source' | 'pricing' | 'pipeline' | 'sales_rep' | 'industry' | 'forecast';
  type: 'positive' | 'warning' | 'critical' | 'neutral';
  title: string;
  description: string;
  metric?: string;
  actionableStep?: string;
}

export interface SmartRecommendation {
  id: string;
  priority: 'High' | 'Medium' | 'Low';
  title: string;
  description: string;
  impactArea: string;
  estimatedRevenueImpact?: string;
}

export interface ExecutiveSummaryReport {
  businessSummary: string;
  revenueSummary: string;
  growthSummary: string;
  teamSummary: string;
  riskSummary: string;
  opportunitySummary: string;
  topPerformer: string;
  worstPerformer: string;
  mostProfitableIndustry: string;
  mostProfitableSolution: string;
  pipelineHealth: string;
  lostOpportunitySummary: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  tableData?: { headers: string[]; rows: (string | number)[][] };
  chartConfig?: any; // ECharts config
  reportType?: 'summary' | 'swot' | 'forecast';
}
