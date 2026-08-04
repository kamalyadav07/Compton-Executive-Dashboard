import type { EnhancedDealRecord, CustomerFeature, DealFeature, SalespersonFeature, IndustryFeature, FeatureStoreState } from './types';

export class FeatureEngineeringService {
  public computeFeatureStore(records: EnhancedDealRecord[]): FeatureStoreState {
    const customerMap: Record<string, CustomerFeature> = {};
    const dealMap: Record<string, DealFeature> = {};
    const salespersonMap: Record<string, SalespersonFeature> = {};
    const industryMap: Record<string, IndustryFeature> = {};

    const now = new Date();

    // Grouping helpers
    const customerDeals: Record<string, EnhancedDealRecord[]> = {};
    const salespersonDeals: Record<string, EnhancedDealRecord[]> = {};
    const industryDeals: Record<string, EnhancedDealRecord[]> = {};

    records.forEach(r => {
      // 1. Deal Features
      dealMap[r.id] = {
        dealId: r.id,
        customer: r.customer,
        dealSize: r.grossRevenue,
        closingTimeDays: r.salesCycleDays || 30,
        winProbability: r.winProbability || (r.type === 'won' ? 100 : r.type === 'lost' ? 0 : 50),
        marginPct: r.marginPct || 25,
        salesperson: r.salesRep,
        industry: r.industry
      };

      // Grouping
      const custKey = r.customer.trim();
      if (!customerDeals[custKey]) customerDeals[custKey] = [];
      customerDeals[custKey].push(r);

      const repKey = r.salesRep.trim();
      if (!salespersonDeals[repKey]) salespersonDeals[repKey] = [];
      salespersonDeals[repKey].push(r);

      const indKey = r.industry.trim();
      if (!industryDeals[indKey]) industryDeals[indKey] = [];
      industryDeals[indKey].push(r);
    });

    // 2. Customer Features
    Object.entries(customerDeals).forEach(([custName, cRecords]) => {
      const wonRecords = cRecords.filter(r => r.type === 'won');
      const totalLifetimeRev = wonRecords.reduce((sum, r) => sum + r.netRevenue, 0);
      const totalWonCount = wonRecords.length;
      const avgDealSize = totalWonCount > 0 ? totalLifetimeRev / totalWonCount : 0;

      // Dates
      const dates = cRecords.map(r => new Date(r.date).getTime()).filter(t => !isNaN(t));
      const latestDateMs = dates.length > 0 ? Math.max(...dates) : now.getTime();
      const daysSinceLast = Math.max(0, Math.floor((now.getTime() - latestDateMs) / (1000 * 60 * 60 * 24)));

      // Rolling 90 Day Revenue
      const ninetyDaysAgoMs = now.getTime() - (90 * 24 * 60 * 60 * 1000);
      const rolling90Rev = wonRecords
        .filter(r => new Date(r.date).getTime() >= ninetyDaysAgoMs)
        .reduce((sum, r) => sum + r.netRevenue, 0);

      // Customer Health Score Formula (0 - 100)
      // High score if recent purchase (<60 days), high revenue, high win ratio
      const recencyScore = Math.max(0, 40 - daysSinceLast * 0.5);
      const winRatioScore = (wonRecords.length / cRecords.length) * 40;
      const revScore = Math.min(20, (totalLifetimeRev / 500000) * 20);
      const healthScore = Math.min(100, Math.round(recencyScore + winRatioScore + revScore));

      customerMap[custName] = {
        customerId: `cust_${custName.replace(/\s+/g, '_').toLowerCase()}`,
        customerName: custName,
        totalWonDeals: totalWonCount,
        totalLifetimeRevenue: totalLifetimeRev,
        avgDealSize: Math.round(avgDealSize),
        daysSinceLastPurchase: daysSinceLast,
        rolling90DayRevenue: rolling90Rev,
        healthScore,
        industry: cRecords[0]?.industry || 'General',
        lastPurchaseDate: new Date(latestDateMs).toISOString().split('T')[0]
      };
    });

    // 3. Salesperson Features
    Object.entries(salespersonDeals).forEach(([repName, sRecords]) => {
      const won = sRecords.filter(r => r.type === 'won');
      const lost = sRecords.filter(r => r.type === 'lost');
      const wonRev = won.reduce((sum, r) => sum + r.netRevenue, 0);
      const winRatePct = sRecords.length > 0 ? (won.length / (won.length + lost.length || 1)) * 100 : 0;
      const closingDays = sRecords.map(r => r.salesCycleDays || 30);
      const avgClosingTime = Math.round(closingDays.reduce((a, b) => a + b, 0) / (closingDays.length || 1));

      const ninetyDaysAgoMs = now.getTime() - (90 * 24 * 60 * 60 * 1000);
      const rolling90Rev = won
        .filter(r => new Date(r.date).getTime() >= ninetyDaysAgoMs)
        .reduce((sum, r) => sum + r.netRevenue, 0);

      salespersonMap[repName] = {
        salesRep: repName,
        totalWonRevenue: wonRev,
        wonCount: won.length,
        lostCount: lost.length,
        winRatePct: Math.round(winRatePct),
        avgClosingTimeDays: avgClosingTime,
        avgDealSize: won.length > 0 ? Math.round(wonRev / won.length) : 0,
        rolling90DayRevenue: rolling90Rev
      };
    });

    // 4. Industry Features
    Object.entries(industryDeals).forEach(([indName, iRecords]) => {
      const won = iRecords.filter(r => r.type === 'won');
      const lost = iRecords.filter(r => r.type === 'lost');
      const totalRev = won.reduce((sum, r) => sum + r.netRevenue, 0);
      const winRatePct = (won.length + lost.length) > 0 ? (won.length / (won.length + lost.length)) * 100 : 0;

      industryMap[indName] = {
        industry: indName,
        totalRevenue: totalRev,
        dealCount: iRecords.length,
        winRatePct: Math.round(winRatePct),
        avgDealSize: won.length > 0 ? Math.round(totalRev / won.length) : 0
      };
    });

    return {
      customerFeatures: customerMap,
      dealFeatures: dealMap,
      salespersonFeatures: salespersonMap,
      industryFeatures: industryMap,
      lastUpdated: new Date().toISOString()
    };
  }
}

export const globalFeatureEngineeringService = new FeatureEngineeringService();
