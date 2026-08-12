/**
 * salesProjectionEngine.ts
 * -----------------------------------------------------------------------
 * Answers exactly the question in your screenshot: "What is my company
 * sales projection this month" — with real numbers, not an LLM guess.
 *
 * DESIGN RULE (carried over from dealIntelligenceEngine.ts): the chatbot's
 * LLM is only ever allowed to *phrase* these numbers, never *compute* them.
 * This file is what the LangChain tool in server/tools/salesProjectionTool.js
 * calls — the LLM gets the JSON this produces and is instructed to only
 * reformat it into prose.
 *
 * Your financial year starts 1 April — every "this month" / "this year"
 * calculation below respects that (FY2026 = 1 Apr 2026 → 31 Mar 2027).
 */

import type { DealRecord } from '../types/sales';
import { splitGst } from '../utils/financeUtils';
import { cleanDealTitle, formatDealLabel } from '../utils/textUtils';
export { cleanDealTitle, formatDealLabel };
import { runDealIntelligence, probabilityCloseWithinDays, type DealIntelligenceResult } from './dealIntelligenceEngine';

/**
 * Shared function that builds a sanitized, human-readable deal label for UI & tool outputs.
 */
export function dealLabel(deal: DealRecord): string {
  const rawTitle = (deal.rawRecord?.TITLE as string) || `${deal.customer}`;
  return formatDealLabel(rawTitle, deal.id);
}

export interface PeriodBounds {
  start: Date;
  end: Date;
  label: string;
}

export function getFYBounds(asOf: Date = new Date()): PeriodBounds {
  const year = asOf.getMonth() >= 3 /* April = index 3 */ ? asOf.getFullYear() : asOf.getFullYear() - 1;
  return {
    start: new Date(year, 3, 1),
    end: new Date(year + 1, 2, 31, 23, 59, 59),
    label: `FY${year}-${String(year + 1).slice(2)}`
  };
}

export function getMonthBounds(asOf: Date = new Date()): PeriodBounds {
  const start = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  const end = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0, 23, 59, 59);
  return { start, end, label: start.toLocaleString('en-IN', { month: 'long', year: 'numeric' }) };
}

/** Real (GST-removed) revenue already booked from WON deals closed within a period. */
export function computeRevenueToDate(deals: DealRecord[], period: PeriodBounds): number {
  return deals
    .filter(d => d.type === 'won')
    .filter(d => {
      const closeDate = new Date(d.rawRecord?.CLOSEDATE || d.rawRecord?.DATE_MODIFY || d.date);
      return closeDate >= period.start && closeDate <= period.end;
    })
    .reduce((sum, d) => sum + splitGst(d.grossRevenue, true).netRevenue, 0);
}

/** Total value currently sitting in the open pipeline (net-of-GST equivalent, for apples-to-apples comparison with revenue). */
export function computePipelineValue(deals: DealRecord[]): number {
  return deals
    .filter(d => d.type === 'in_progress')
    .reduce((sum, d) => sum + splitGst(d.grossRevenue, true).netRevenue, 0);
}

/**
 * Expected value of the pipeline that's realistically going to land inside
 * a given period, using the trained win-probability model AND the
 * empirical "closes within N days" estimator from dealIntelligenceEngine —
 * NOT just "probability × total pipeline", which overstates a projection
 * by including deals that won't close in time even if they eventually win.
 */
export function computeWeightedForecast(
  intelligence: DealIntelligenceResult[],
  period: PeriodBounds,
  asOf: Date = new Date(),
  distribution?: Record<string, number[]>
): { expectedValue: number; highConfidenceDeals: DealIntelligenceResult[] } {
  const daysToHorizon = Math.max(0, Math.round((period.end.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24)));

  let expectedValue = 0;
  const highConfidenceDeals: DealIntelligenceResult[] = [];

  intelligence.forEach(r => {
    let closeWithinHorizonPct: number;
    if (distribution) {
      const res = probabilityCloseWithinDays(r.deal, distribution, daysToHorizon);
      closeWithinHorizonPct = res.probabilityPct;
    } else {
      if (daysToHorizon <= 7) {
        closeWithinHorizonPct = r.closesWithin7DaysPct * (daysToHorizon / 7);
      } else if (daysToHorizon <= 15) {
        const t = (daysToHorizon - 7) / 8;
        closeWithinHorizonPct = r.closesWithin7DaysPct + t * (r.closesWithin15DaysPct - r.closesWithin7DaysPct);
      } else {
        closeWithinHorizonPct = r.closesWithin15DaysPct;
      }
    }

    const netValue = splitGst(r.deal.grossRevenue, true).netRevenue;
    const contribution = netValue * (r.winProbabilityPct / 100) * (closeWithinHorizonPct / 100);
    expectedValue += contribution;

    if (r.winProbabilityPct >= 60 && closeWithinHorizonPct >= 50) {
      highConfidenceDeals.push(r);
    }
  });

  return { expectedValue: Math.round(expectedValue), highConfidenceDeals };
}

export interface SalesProjection {
  period: string;
  periodStart: string;
  periodEnd: string;
  revenueToDate: number;
  pipelineValue: number;
  weightedForecastAdditional: number;
  totalProjection: number;
  target: number;
  gapToTarget: number;
  projectedAttainmentPct: number;
  onTrack: boolean;
  topDealsLikelyToClose: Array<{
    dealId: string;
    dealName: string;
    company: string;
    salesRep: string;
    netValue: number;
    winProbabilityPct: number;
    closesWithin7DaysPct: number;
    closesWithin15DaysPct: number;
    expectedCloseDate: string;
  }>;
  dealCounts: { won: number; open: number; lost: number };
}

/**
 * Top-level entry point — this is the ONE function the LangChain tool
 * calls for "what's my projection this month / this year" type questions.
 */
export function computeSalesProjection(
  allDeals: DealRecord[],
  scope: 'month' | 'fy',
  targets: { monthlyTarget: number; yearlyTarget: number },
  asOf: Date = new Date()
): SalesProjection {
  const period = scope === 'month' ? getMonthBounds(asOf) : getFYBounds(asOf);
  const target = scope === 'month' ? targets.monthlyTarget : targets.yearlyTarget;

  const revenueToDate = computeRevenueToDate(allDeals, period);
  const pipelineValue = computePipelineValue(allDeals);

  const { results: intelligence, distribution } = runDealIntelligence(allDeals);
  const { expectedValue, highConfidenceDeals } = computeWeightedForecast(intelligence, period, asOf, distribution);

  const totalProjection = revenueToDate + expectedValue;
  const gapToTarget = target - totalProjection;
  const projectedAttainmentPct = target > 0 ? Math.round((totalProjection / target) * 100) : 0;

  return {
    period: period.label,
    periodStart: period.start.toISOString().slice(0, 10),
    periodEnd: period.end.toISOString().slice(0, 10),
    revenueToDate: Math.round(revenueToDate),
    pipelineValue: Math.round(pipelineValue),
    weightedForecastAdditional: expectedValue,
    totalProjection: Math.round(totalProjection),
    target,
    gapToTarget: Math.round(gapToTarget),
    projectedAttainmentPct,
    onTrack: totalProjection >= target,
    topDealsLikelyToClose: highConfidenceDeals
      .sort((a, b) => b.winProbabilityPct - a.winProbabilityPct)
      .slice(0, 8)
      .map(r => ({
        dealId: r.deal.id,
        dealName: dealLabel(r.deal),
        company: r.deal.customer,
        salesRep: r.deal.salesRep || 'Unassigned',
        netValue: splitGst(r.deal.grossRevenue, true).netRevenue,
        winProbabilityPct: r.winProbabilityPct,
        closesWithin7DaysPct: r.closesWithin7DaysPct,
        closesWithin15DaysPct: r.closesWithin15DaysPct,
        expectedCloseDate: r.expectedCloseDate
      })),
    dealCounts: {
      won: allDeals.filter(d => d.type === 'won').length,
      open: allDeals.filter(d => d.type === 'in_progress').length,
      lost: allDeals.filter(d => d.type === 'lost').length
    }
  };
}
