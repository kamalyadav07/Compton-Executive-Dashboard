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
