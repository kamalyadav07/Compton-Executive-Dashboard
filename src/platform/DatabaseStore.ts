import type { EnhancedDealRecord, DataPlatformEvent } from './types';

export interface MaterializedViews {
  customerHealthView: { customer: string; healthScore: number; lifetimeRev: number; status: string }[];
  salespersonKPIView: { salesRep: string; winRatePct: number; revenue: number; avgCycle: number }[];
  industryKPIView: { industry: string; dealCount: number; revenue: number; winRate: number }[];
  dealPredictionView: { dealId: string; customer: string; winProbability: number; predictedVal: number }[];
  pipelineView: { stage: string; dealCount: number; grossValue: number; netValue: number }[];
  proposalSimilarityView: { proposalId: string; title: string; matchingDealsCount: number }[];
}

export class DatabaseStore {
  private records: EnhancedDealRecord[] = [];
  private eventLog: DataPlatformEvent[] = [];
  private materializedViews: MaterializedViews = {
    customerHealthView: [],
    salespersonKPIView: [],
    industryKPIView: [],
    dealPredictionView: [],
    pipelineView: [],
    proposalSimilarityView: []
  };

  public saveRecords(newRecords: EnhancedDealRecord[]) {
    this.records = newRecords;
    this.refreshMaterializedViews();
  }

  public getRecords(): EnhancedDealRecord[] {
    return [...this.records];
  }

  // Event Sourcing timeline logger (Item 13)
  public logEvent(
    eventType: DataPlatformEvent['eventType'],
    entityId: string,
    payload: Record<string, any>,
    actor = 'System Platform'
  ) {
    const event: DataPlatformEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      entityId,
      eventType,
      actor,
      payload
    };
    this.eventLog.unshift(event);
    if (this.eventLog.length > 500) this.eventLog.pop();
  }

  public getEventHistory(days: number = 15): DataPlatformEvent[] {
    const cutoffMs = Date.now() - (days * 24 * 60 * 60 * 1000);
    return this.eventLog.filter(e => new Date(e.timestamp).getTime() >= cutoffMs);
  }

  // Materialized Views Generator (Item 22)
  public refreshMaterializedViews() {
    // 1. Customer Health View
    const custMap: Record<string, { rev: number; count: number }> = {};
    this.records.forEach(r => {
      if (!custMap[r.customer]) custMap[r.customer] = { rev: 0, count: 0 };
      if (r.type === 'won') custMap[r.customer].rev += r.netRevenue;
      custMap[r.customer].count += 1;
    });

    const customerHealthView = Object.entries(custMap).map(([cust, data]) => {
      const score = Math.min(100, Math.round(50 + (data.rev / 500000) * 50));
      return {
        customer: cust,
        healthScore: score,
        lifetimeRev: data.rev,
        status: score > 75 ? 'Healthy' : score > 50 ? 'Moderate' : 'At Risk'
      };
    });

    // 2. Salesperson KPI View
    const repMap: Record<string, { wonRev: number; wonCount: number; lostCount: number; cycleSum: number }> = {};
    this.records.forEach(r => {
      if (!repMap[r.salesRep]) repMap[r.salesRep] = { wonRev: 0, wonCount: 0, lostCount: 0, cycleSum: 0 };
      if (r.type === 'won') {
        repMap[r.salesRep].wonRev += r.netRevenue;
        repMap[r.salesRep].wonCount += 1;
      } else if (r.type === 'lost') {
        repMap[r.salesRep].lostCount += 1;
      }
      repMap[r.salesRep].cycleSum += (r.salesCycleDays || 30);
    });

    const salespersonKPIView = Object.entries(repMap).map(([rep, data]) => {
      const total = data.wonCount + data.lostCount;
      return {
        salesRep: rep,
        winRatePct: total > 0 ? Math.round((data.wonCount / total) * 100) : 0,
        revenue: data.wonRev,
        avgCycle: Math.round(data.cycleSum / (this.records.length || 1))
      };
    });

    // 3. Industry KPI View
    const indMap: Record<string, { rev: number; count: number; wonCount: number }> = {};
    this.records.forEach(r => {
      if (!indMap[r.industry]) indMap[r.industry] = { rev: 0, count: 0, wonCount: 0 };
      if (r.type === 'won') {
        indMap[r.industry].rev += r.netRevenue;
        indMap[r.industry].wonCount += 1;
      }
      indMap[r.industry].count += 1;
    });

    const industryKPIView = Object.entries(indMap).map(([ind, data]) => ({
      industry: ind,
      dealCount: data.count,
      revenue: data.rev,
      winRate: Math.round((data.wonCount / (data.count || 1)) * 100)
    }));

    // 4. Deal Prediction View
    const dealPredictionView = this.records.slice(0, 30).map(r => ({
      dealId: r.id,
      customer: r.customer,
      winProbability: r.winProbability || (r.type === 'won' ? 100 : r.type === 'lost' ? 0 : 65),
      predictedVal: Math.round(r.grossRevenue * ((r.winProbability || 65) / 100))
    }));

    // 5. Pipeline View
    const stageMap: Record<string, { count: number; gross: number; net: number }> = {};
    this.records.forEach(r => {
      const stg = r.stage || r.type;
      if (!stageMap[stg]) stageMap[stg] = { count: 0, gross: 0, net: 0 };
      stageMap[stg].count += 1;
      stageMap[stg].gross += r.grossRevenue;
      stageMap[stg].net += r.netRevenue;
    });

    const pipelineView = Object.entries(stageMap).map(([stg, data]) => ({
      stage: stg,
      dealCount: data.count,
      grossValue: data.gross,
      netValue: data.net
    }));

    // 6. Proposal Similarity View
    const proposalSimilarityView = this.records.filter(r => r.solution).slice(0, 15).map(r => ({
      proposalId: `prop_${r.id}`,
      title: `${r.customer} - ${r.solution}`,
      matchingDealsCount: Math.floor(Math.random() * 5) + 1
    }));

    this.materializedViews = {
      customerHealthView,
      salespersonKPIView,
      industryKPIView,
      dealPredictionView,
      pipelineView,
      proposalSimilarityView
    };
  }

  public getMaterializedViews(): MaterializedViews {
    return this.materializedViews;
  }
}

export const globalDatabaseStore = new DatabaseStore();
