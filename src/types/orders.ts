export interface OrderRecord {
  id: string;
  dealId: string;
  sNo: number;
  customerName: string;
  dealName: string;
  salesRep: string;
  amount: number;
  orderDate: string;
  isoCreationDate?: string;
  billedDate: string;
  status: 'Billed' | 'Unbilled';
  source?: string;
  solutionType?: string;
  industry?: string;
  rawRecord?: Record<string, any>;
}

export interface OperationalKPIMetrics {
  // Orders Metrics
  ordersBilledCount: number;
  ordersBilledValue: number;
  unbilledOrdersCount: number;
  unbilledOrdersValue: number;
  salesOrdersCreatedCount: number;
  salesOrdersCreatedValue: number;

  // Deals Metrics
  dealsWonCount: number;
  dealsWonValue: number;
  dealsLostCount: number;
  dealsLostValue: number;
  dealsInProgressCount: number;
  dealsInProgressValue: number;

  // Leads Metrics
  leadsQualifiedCount: number;
  leadsDisqualifiedCount: number;
  leadsInProgressCount: number;
  totalLeadsGeneratedCount: number;
}
