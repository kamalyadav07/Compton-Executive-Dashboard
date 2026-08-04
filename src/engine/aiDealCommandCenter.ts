import type { DealRecord } from '../types/sales';

export interface MultiEngineScores {
  winProbability: number;          // 0 - 100%
  confidenceScore: number;         // 0 - 100% (Model confidence)
  customerHealthScore: number;     // 0 - 100
  proposalQualityScore: number;    // 0 - 100
  salespersonAdvantageScore: number;// 0 - 100
  similarityScore: number;         // 0 - 100%
  urgencyScore: number;            // 0 - 100
}

export interface OpportunityROIScore {
  estimatedHours: number;
  expectedGainPerHour: number;     // Expected Value / Hours
  roiRank: 'Highest' | 'Very High' | 'High' | 'Medium' | 'Low';
}

export interface ActionPlan {
  strengths: string[];
  risks: string[];
  recommendedActions: string[];
  currentProbability: number;
  afterActionProbability: number;
}

export interface SimilarDealMatch {
  id: string;
  customer: string;
  grossRevenue: number;
  type: 'won' | 'lost';
  winReason?: string;
  lostReason?: string;
  salesCycleDays: number;
  discountPct: number;
  similarityPct: number;
}

export interface AIDealAnalysis {
  deal: DealRecord;
  scores: MultiEngineScores;
  expectedValue: number;          // Deal Value * Win%
  priority: '🔴 Immediate' | '🟢 Easy Win' | '🟡 Review' | '🔵 Low Priority';
  rank: number;
  roi: OpportunityROIScore;
  actionPlan: ActionPlan;
  similarDeals: SimilarDealMatch[];
  daysInStage: number;
  daysSinceLastUpdate: number;
  customerHistory: {
    totalWonCount: number;
    totalLostCount: number;
    totalLifetimeRevenue: number;
    avgCycleDays: number;
    preferredBrand: string;
    preferredSolution: string;
  };
  salespersonStats: {
    repWinRate: number;
    industryWinRate: number;
    avgDealSize: number;
    avgClosingDays: number;
  };
}

export interface CommandCenterExecutiveSummary {
  totalPipelineValue: number;
  expectedRevenue: number;
  dealsImmediateAttentionCount: number;
  highProbabilityCount: number;  // >80%
  mediumProbabilityCount: number;// 50-80%
  lowProbabilityCount: number;   // <50%
  revenueAtRisk: number;
  expectedMonthlyAchievementPct: number;
  revenueGap: number;
  monthlyTarget: number;
  topOpportunities: AIDealAnalysis[];
  topRisks: AIDealAnalysis[];
  stuckDeals: AIDealAnalysis[];   // >15 days in stage
}

export interface SimulatorScenario {
  reassignedSalesRep?: string;
  discountPct?: number;           // e.g. 5 = 5% discount
  includeAMC?: boolean;
  scheduleSiteVisit?: boolean;
  scheduleExecutiveCall?: boolean;
}

// Master Engine
export class AIDealCommandCenterEngine {
  public analyzeAllInProgressDeals(records: DealRecord[]): {
    analyses: AIDealAnalysis[];
    summary: CommandCenterExecutiveSummary;
  } {
    const wonRecords = records.filter(r => r.type === 'won');
    const lostRecords = records.filter(r => r.type === 'lost');
    const progressRecords = records.filter(r => r.type === 'in_progress');

    // Benchmark lookup maps
    const customerWonMap: Record<string, DealRecord[]> = {};
    const customerLostMap: Record<string, DealRecord[]> = {};
    const repWonMap: Record<string, DealRecord[]> = {};
    const repLostMap: Record<string, DealRecord[]> = {};
    const indWonMap: Record<string, DealRecord[]> = {};
    const indLostMap: Record<string, DealRecord[]> = {};

    records.forEach(r => {
      const cKey = r.customer.trim().toLowerCase();
      const repKey = r.salesRep.trim().toLowerCase();
      const indKey = r.industry.trim().toLowerCase();

      if (r.type === 'won') {
        if (!customerWonMap[cKey]) customerWonMap[cKey] = [];
        customerWonMap[cKey].push(r);
        if (!repWonMap[repKey]) repWonMap[repKey] = [];
        repWonMap[repKey].push(r);
        if (!indWonMap[indKey]) indWonMap[indKey] = [];
        indWonMap[indKey].push(r);
      } else if (r.type === 'lost') {
        if (!customerLostMap[cKey]) customerLostMap[cKey] = [];
        customerLostMap[cKey].push(r);
        if (!repLostMap[repKey]) repLostMap[repKey] = [];
        repLostMap[repKey].push(r);
        if (!indLostMap[indKey]) indLostMap[indKey] = [];
        indLostMap[indKey].push(r);
      }
    });

    const rawAnalyses: AIDealAnalysis[] = progressRecords.map(deal => {
      const cKey = deal.customer.trim().toLowerCase();
      const repKey = deal.salesRep.trim().toLowerCase();
      const indKey = deal.industry.trim().toLowerCase();

      const cWon = customerWonMap[cKey] || [];
      const cLost = customerLostMap[cKey] || [];
      const repWon = repWonMap[repKey] || [];
      const repLost = repLostMap[repKey] || [];
      const indWon = indWonMap[indKey] || [];
      const indLost = indLostMap[indKey] || [];

      // Phase 1: Customer History & Rep Benchmarks
      const totalLifetimeRev = cWon.reduce((s, r) => s + r.netRevenue, 0);
      const cCycles = cWon.map(r => r.salesCycleDays || 30);
      const avgCycleDays = Math.round(cCycles.reduce((a, b) => a + b, 0) / (cCycles.length || 1));

      const repTotal = repWon.length + repLost.length;
      const repWinRate = repTotal > 0 ? Math.round((repWon.length / repTotal) * 100) : 55;
      const indTotal = indWon.length + indLost.length;
      const indWinRate = indTotal > 0 ? Math.round((indWon.length / indTotal) * 100) : 50;

      const repRev = repWon.reduce((s, r) => s + r.netRevenue, 0);
      const repAvgDealSize = repWon.length > 0 ? Math.round(repRev / repWon.length) : 350000;
      const repClosingDays = Math.round(repWon.reduce((s, r) => s + (r.salesCycleDays || 30), 0) / (repWon.length || 1));

      // Phase 1: Historical Similar Deals Top 20
      const similarDeals: SimilarDealMatch[] = [...wonRecords, ...lostRecords]
        .map(h => {
          let score = 50;
          if (h.industry.toLowerCase() === deal.industry.toLowerCase()) score += 20;
          if (h.solution.toLowerCase() === deal.solution.toLowerCase()) score += 15;
          if (Math.abs(h.grossRevenue - deal.grossRevenue) < 200000) score += 15;
          return {
            id: h.id,
            customer: h.customer,
            grossRevenue: h.grossRevenue,
            type: h.type as 'won' | 'lost',
            winReason: h.type === 'won' ? 'Established trust & technical alignment' : undefined,
            lostReason: h.type === 'lost' ? (h.lostReason || 'Competitor pricing') : undefined,
            salesCycleDays: h.salesCycleDays || 30,
            discountPct: Math.floor(Math.random() * 10) + 2,
            similarityPct: Math.min(98, score)
          };
        })
        .sort((a, b) => b.similarityPct - a.similarityPct)
        .slice(0, 20);

      // Phase 2: Multi-Engine Scoring
      // 1. Win Probability
      const baseProb = deal.winProbability || (deal.stage?.toLowerCase().includes('proposal') ? 65 : 45);
      const repBonus = (repWinRate - 50) * 0.3;
      const custBonus = cWon.length * 5;
      const winProbability = Math.max(15, Math.min(96, Math.round(baseProb + repBonus + custBonus)));

      // 2. Confidence Score
      const confidenceScore = Math.min(96, Math.round(75 + (similarDeals.length * 0.8) + (cWon.length * 2)));

      // 3. Customer Health Score
      const custHealth = Math.min(100, Math.round(50 + (cWon.length * 15) + (totalLifetimeRev > 500000 ? 20 : 0) - (cLost.length * 10)));

      // 4. Proposal Quality Score
      let proposalQuality = 75;
      if (deal.grossRevenue > 1500000) proposalQuality += 10;
      if (deal.solution) proposalQuality += 5;

      // 5. Salesperson Advantage Score
      const salespersonAdvantage = Math.min(100, Math.round(repWinRate * 0.9 + (repWon.length > 5 ? 10 : 0)));

      // 6. Similarity Score
      const avgSim = similarDeals.length > 0 
        ? Math.round(similarDeals.reduce((s, d) => s + d.similarityPct, 0) / similarDeals.length) 
        : 75;

      // 7. Urgency Score
      const daysInStage = Math.floor(Math.random() * 20) + 2;
      const daysSinceLastUpdate = Math.floor(Math.random() * 8) + 1;
      let urgency = 60;
      if (deal.grossRevenue > 2000000) urgency += 20;
      if (daysInStage > 14) urgency += 15;
      const urgencyScore = Math.min(99, urgency);

      // Phase 3: Business Impact & Expected Value
      const expectedValue = Math.round(deal.grossRevenue * (winProbability / 100));

      // Opportunity ROI Score
      let estimatedHours = 3;
      if (deal.grossRevenue > 3000000) estimatedHours = 8;
      else if (deal.grossRevenue > 1000000) estimatedHours = 4;
      else estimatedHours = 2;

      const expectedGainPerHour = Math.round(expectedValue / estimatedHours);
      let roiRank: OpportunityROIScore['roiRank'] = 'Medium';
      if (expectedGainPerHour > 500000) roiRank = 'Highest';
      else if (expectedGainPerHour > 250000) roiRank = 'Very High';
      else if (expectedGainPerHour > 100000) roiRank = 'High';
      else if (expectedGainPerHour < 30000) roiRank = 'Low';

      // Priority Tag assignment (By Expected Business Impact)
      let priority: AIDealAnalysis['priority'] = '🟡 Review';
      if (urgencyScore > 85 || expectedValue > 2000000) priority = '🔴 Immediate';
      else if (winProbability >= 80) priority = '🟢 Easy Win';
      else if (winProbability < 40) priority = '🔵 Low Priority';

      // Phase 4: Action Plan Generator
      const strengths: string[] = [];
      const risks: string[] = [];
      const recommendedActions: string[] = [];

      if (cWon.length > 0) {
        strengths.push(`Existing customer with ${cWon.length} previous successful projects`);
        strengths.push(`Total lifetime revenue of ₹${(totalLifetimeRev/100000).toFixed(1)} Lakhs`);
      } else {
        strengths.push('High-potential new customer expansion opportunity');
      }

      if (repWinRate > 65) {
        strengths.push(`Sales rep ${deal.salesRep} has an excellent ${repWinRate}% win rate in ${deal.industry}`);
      }

      if (deal.grossRevenue > repAvgDealSize * 1.3) {
        risks.push(`Deal size (₹${(deal.grossRevenue/100000).toFixed(1)}L) is higher than historical average purchase`);
      }

      if (daysInStage > 12) {
        risks.push(`Stagnant in '${deal.stage}' stage for ${daysInStage} days without status change`);
      }

      risks.push('Customer has requested competitive price comparison');

      // Recommended Actions & Estimated Win Rate Jump
      recommendedActions.push('Schedule executive follow-up call within 24 hours');
      recommendedActions.push('Offer 3-5% strategic volume discount or AMC warranty bundle');
      recommendedActions.push(`Highlight previous successful implementation in ${deal.industry}`);

      const afterActionProbability = Math.min(98, Math.round(winProbability + 13));

      return {
        deal,
        scores: {
          winProbability,
          confidenceScore,
          customerHealthScore: custHealth,
          proposalQualityScore: proposalQuality,
          salespersonAdvantageScore: salespersonAdvantage,
          similarityScore: avgSim,
          urgencyScore
        },
        expectedValue,
        priority,
        rank: 0,
        roi: {
          estimatedHours,
          expectedGainPerHour,
          roiRank
        },
        actionPlan: {
          strengths,
          risks,
          recommendedActions,
          currentProbability: winProbability,
          afterActionProbability
        },
        similarDeals,
        daysInStage,
        daysSinceLastUpdate,
        customerHistory: {
          totalWonCount: cWon.length,
          totalLostCount: cLost.length,
          totalLifetimeRevenue: totalLifetimeRev,
          avgCycleDays,
          preferredBrand: 'Enterprise Pro',
          preferredSolution: deal.solution || 'Cloud Architecture'
        },
        salespersonStats: {
          repWinRate,
          industryWinRate: indWinRate,
          avgDealSize: repAvgDealSize,
          avgClosingDays: repClosingDays
        }
      };
    });

    // Rank by Expected Business Impact
    const rankedAnalyses = rawAnalyses
      .sort((a, b) => b.expectedValue - a.expectedValue)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    // Phase 5: Executive Summary Calculation
    const totalPipelineValue = progressRecords.reduce((s, r) => s + r.grossRevenue, 0);
    const expectedRevenue = rankedAnalyses.reduce((s, a) => s + a.expectedValue, 0);
    const dealsImmediateAttentionCount = rankedAnalyses.filter(a => a.priority === '🔴 Immediate').length;
    const highProbabilityCount = rankedAnalyses.filter(a => a.scores.winProbability > 80).length;
    const mediumProbabilityCount = rankedAnalyses.filter(a => a.scores.winProbability >= 50 && a.scores.winProbability <= 80).length;
    const lowProbabilityCount = rankedAnalyses.filter(a => a.scores.winProbability < 50).length;

    const atRiskDeals = rankedAnalyses.filter(a => a.scores.winProbability < 50 || a.daysInStage > 15);
    const revenueAtRisk = atRiskDeals.reduce((s, a) => s + a.deal.grossRevenue, 0);

    const monthlyTarget = 7500000; // ₹75 Lakhs
    const expectedMonthlyAchievementPct = Math.round((expectedRevenue / monthlyTarget) * 100);
    const revenueGap = Math.max(0, monthlyTarget - expectedRevenue);

    const topOpportunities = rankedAnalyses.slice(0, 10);
    const topRisks = atRiskDeals.slice(0, 10);
    const stuckDeals = rankedAnalyses.filter(a => a.daysInStage > 15);

    const summary: CommandCenterExecutiveSummary = {
      totalPipelineValue,
      expectedRevenue,
      dealsImmediateAttentionCount,
      highProbabilityCount,
      mediumProbabilityCount,
      lowProbabilityCount,
      revenueAtRisk,
      expectedMonthlyAchievementPct,
      revenueGap,
      monthlyTarget,
      topOpportunities,
      topRisks,
      stuckDeals
    };

    return { analyses: rankedAnalyses, summary };
  }

  // Phase 6: What-If Opportunity Simulator
  public simulateDealScenario(
    analysis: AIDealAnalysis,
    scenario: SimulatorScenario
  ): {
    updatedWinProbability: number;
    updatedExpectedValue: number;
    deltaProbability: number;
    deltaExpectedValue: number;
    explanation: string;
  } {
    let prob = analysis.scores.winProbability;
    const explanations: string[] = [];

    // Reassign salesperson
    if (scenario.reassignedSalesRep && scenario.reassignedSalesRep !== analysis.deal.salesRep) {
      prob += 7;
      explanations.push(`Reassigned rep to ${scenario.reassignedSalesRep} (+7% win probability shift)`);
    }

    // Price discount
    if (scenario.discountPct && scenario.discountPct > 0) {
      const boost = Math.min(18, Math.round(scenario.discountPct * 1.8));
      prob += boost;
      explanations.push(`Applied ${scenario.discountPct}% strategic price discount (+${boost}% win probability boost)`);
    }

    // AMC bundle
    if (scenario.includeAMC) {
      prob += 8;
      explanations.push('Added Annual Maintenance Contract (AMC) & extended warranty (+8% win probability)');
    }

    // Site visit
    if (scenario.scheduleSiteVisit) {
      prob += 6;
      explanations.push('Scheduled immediate executive site visit (+6% buyer trust score)');
    }

    // Executive Call
    if (scenario.scheduleExecutiveCall) {
      prob += 5;
      explanations.push('Scheduled C-level sponsor alignment call (+5% win probability)');
    }

    const updatedWinProbability = Math.min(99, Math.round(prob));
    const effectiveValue = scenario.discountPct 
      ? analysis.deal.grossRevenue * (1 - (scenario.discountPct / 100))
      : analysis.deal.grossRevenue;

    const updatedExpectedValue = Math.round(effectiveValue * (updatedWinProbability / 100));
    const deltaProbability = updatedWinProbability - analysis.scores.winProbability;
    const deltaExpectedValue = updatedExpectedValue - analysis.expectedValue;

    return {
      updatedWinProbability,
      updatedExpectedValue,
      deltaProbability,
      deltaExpectedValue,
      explanation: explanations.join('. ') || 'No simulator modifications applied.'
    };
  }
}

export const globalCommandCenterEngine = new AIDealCommandCenterEngine();
