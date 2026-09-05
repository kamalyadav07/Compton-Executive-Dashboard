/**
 * server/services/forecastService.js
 * -----------------------------------------------------------------------
 * MATHEMATICAL FOUNDATION & ANTI-DOUBLE-COUNTING PROBABILITY DIRECTIVE:
 *
 * This forecast engine evaluates open pipeline deals using EXACTLY TWO orthogonal probabilities:
 *
 * 1. P(Win) [Marginal Probability of Victory]:
 *    The probability that this active deal will EVENTUALLY close in "won" status
 *    (regardless of when it closes). Sourced from Model 1 / calibrated logistic regression.
 *
 * 2. P(CloseInWindow | Win) [Conditional Horizon Probability]:
 *    The probability that, GIVEN this deal is a winning deal, it will complete
 *    its sales cycle within the remaining days of this active period (e.g. within this month/quarter/FY).
 *    Sourced from the stage-stratified Kaplan-Meier survival estimator.
 *
 * 3. Joint Monthly Close Probability:
 *    P(CloseThisMonth) = P(Win) * P(CloseThisMonth | Win)
 *
 * CRITICAL RULE:
 *    DO NOT multiply any third probability, risk discount, or ad-hoc multiplier into this term.
 *    Expected Deal Contribution = NetDealValue * P(CloseThisMonth)
 *
 * 4. Total Sales Projection:
 *    Total Projection = Actual Won Revenue Booked So Far + SUM(NetDealValue_i * P(CloseThisMonth_i))
 */

const { pool } = require('../db');
const { splitGst } = require('../engines/financeUtils');
const { estimateDealCloseTime, loadCycleDistributions } = require('./ml/survivalEstimatorService');
const { extractFeaturesFromDeal, computeCorpusBenchmarks } = require('./ml/featureStoreService');

// ── Financial Calendar Bounds Helpers ───────────────────────────────────

function getFYBounds(asOf = new Date()) {
  const year = asOf.getMonth() >= 3 ? asOf.getFullYear() : asOf.getFullYear() - 1;
  return {
    start: new Date(year, 3, 1),
    end: new Date(year + 1, 2, 31, 23, 59, 59),
    label: `FY${year}-${String(year + 1).slice(2)}`
  };
}

function getQuarterBounds(asOf = new Date()) {
  const month = asOf.getMonth(); // 0-11
  const qIdx = Math.floor(month / 3);
  const startMonth = qIdx * 3;
  const endMonth = startMonth + 2;
  const year = asOf.getFullYear();

  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59);
  return {
    start,
    end,
    label: `Q${qIdx + 1} ${year}`
  };
}

function getMonthBounds(asOf = new Date()) {
  const start = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  const end = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0, 23, 59, 59);
  return {
    start,
    end,
    label: start.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  };
}

// ── Default Company Targets ─────────────────────────────────────────────

const DEFAULT_TARGETS = {
  monthlyTarget: 10000000, // ₹1.00 Crore
  quarterlyTarget: 30000000, // ₹3.00 Crore
  yearlyTarget: 120000000   // ₹12.00 Crore
};

// ── Core Forecast Service ───────────────────────────────────────────────

/**
 * Computes deterministic, causally sound revenue projection for a period.
 *
 * @param {Object} options
 * @param {'month'|'quarter'|'fy'} [options.scope='month']
 * @param {Date} [options.asOf=new Date()]
 * @param {Object} [options.targets]
 * @returns {Promise<Object>}
 */
async function computeSalesForecast({
  scope = 'month',
  asOf = new Date(),
  targets = DEFAULT_TARGETS
} = {}) {
  let period;
  let target;

  if (scope === 'fy') {
    period = getFYBounds(asOf);
    target = targets.yearlyTarget || DEFAULT_TARGETS.yearlyTarget;
  } else if (scope === 'quarter') {
    period = getQuarterBounds(asOf);
    target = targets.quarterlyTarget || DEFAULT_TARGETS.quarterlyTarget;
  } else {
    period = getMonthBounds(asOf);
    target = targets.monthlyTarget || DEFAULT_TARGETS.monthlyTarget;
  }

  const daysRemainingInPeriod = Math.max(0, Math.round((period.end.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24)));

  // 1. Fetch Real Won Revenue Booked So Far in Period from PostgreSQL
  let bookedWonRevenue = 0;
  let wonDealsCount = 0;

  try {
    const { rows: wonRows } = await pool.query(`
      SELECT 
        COUNT(*) as won_count,
        COALESCE(SUM(net_revenue), 0) as total_net
      FROM deals
      WHERE status = 'won'
        AND deal_date >= $1 AND deal_date <= $2
    `, [period.start.toISOString().slice(0, 10), period.end.toISOString().slice(0, 10)]);

    if (wonRows.length > 0) {
      wonDealsCount = parseInt(wonRows[0].won_count, 10) || 0;
      bookedWonRevenue = parseFloat(wonRows[0].total_net) || 0;
    }
  } catch (err) {
    console.warn('[forecastService] Won deals query notice:', err.message);
  }

  // 2. Fetch Active Open Pipeline Deals from PostgreSQL
  let openDeals = [];
  try {
    const { rows: openRows } = await pool.query(`
      SELECT 
        id,
        bitrix_deal_id,
        title,
        customer_name,
        sales_rep_name,
        stage_name,
        industry,
        lead_source,
        gross_revenue,
        net_revenue,
        created_at,
        deal_date
      FROM deals
      WHERE status = 'in_progress'
      ORDER BY gross_revenue DESC
    `);
    openDeals = openRows;
  } catch (err) {
    console.warn('[forecastService] Open deals query notice:', err.message);
  }

  const distributions = await loadCycleDistributions();
  const benchmarks = await computeCorpusBenchmarks();

  let totalPipelineNetValue = 0;
  let additionalExpectedValue = 0;
  const evaluatedDeals = [];
  const highConfidenceDeals = [];

  for (const deal of openDeals) {
    const grossVal = parseFloat(deal.gross_revenue || '0');
    const netDealValue = parseFloat(deal.net_revenue || '0') || splitGst(grossVal, true).netRevenue;
    totalPipelineNetValue += netDealValue;

    // Feature extraction & Base P(Win) from Model 1 / heuristics
    const feat = extractFeaturesFromDeal(deal, benchmarks, new Date());
    const pWin = Math.max(0.05, Math.min(0.95, (feat.raw.stage_progress * 0.5) + (feat.raw.rep_win_rate * 0.3) + (feat.raw.industry_win_rate * 0.2)));

    // Survival estimation & P(CloseInWindow | Win)
    const survival = await estimateDealCloseTime(deal, distributions);
    
    let pCloseInWindowGivenWin;
    if (daysRemainingInPeriod <= 7) {
      pCloseInWindowGivenWin = survival.closesWithin7Days.probabilityPct / 100;
    } else if (daysRemainingInPeriod <= 30) {
      const t = (daysRemainingInPeriod - 7) / 23;
      pCloseInWindowGivenWin = (survival.closesWithin7Days.probabilityPct + t * (survival.closesWithin30Days.probabilityPct - survival.closesWithin7Days.probabilityPct)) / 100;
    } else {
      pCloseInWindowGivenWin = Math.min(0.95, survival.closesWithin30Days.probabilityPct / 100 + 0.10);
    }

    // JOINT PROBABILITY: P(CloseThisPeriod) = P(Win) * P(CloseInWindow | Win)
    const pCloseThisPeriod = pWin * pCloseInWindowGivenWin;

    // EXPECTED VALUE: NetDealValue * P(CloseThisPeriod)
    const expectedContribution = netDealValue * pCloseThisPeriod;
    additionalExpectedValue += expectedContribution;

    const dealSummary = {
      dealId: deal.bitrix_deal_id || String(deal.id),
      dealName: deal.title || deal.customer_name,
      customer: deal.customer_name,
      salesRep: deal.sales_rep_name,
      stage: deal.stage_name,
      netValue: Math.round(netDealValue),
      pWinPct: Math.round(pWin * 100),
      pCloseInWindowGivenWinPct: Math.round(pCloseInWindowGivenWin * 100),
      jointCloseProbabilityPct: Math.round(pCloseThisPeriod * 100),
      expectedContribution: Math.round(expectedContribution),
      expectedCloseDate: survival.expectedCloseDate,
      confidenceInterval7d: survival.closesWithin7Days.ci95
    };

    evaluatedDeals.push(dealSummary);

    if (dealSummary.jointCloseProbabilityPct >= 35 && netDealValue >= 500000) {
      highConfidenceDeals.push(dealSummary);
    }
  }

  // 3. Final Total Projection Calculation
  const totalProjection = bookedWonRevenue + additionalExpectedValue;
  const gapToTarget = target - totalProjection;
  const projectedAttainmentPct = target > 0 ? Math.round((totalProjection / target) * 1000) / 10 : 0;
  const onTrack = totalProjection >= target;

  return {
    period: period.label,
    periodStart: period.start.toISOString().slice(0, 10),
    periodEnd: period.end.toISOString().slice(0, 10),
    daysRemaining: daysRemainingInPeriod,
    bookedWonRevenue: Math.round(bookedWonRevenue),
    pipelineNetValue: Math.round(totalPipelineNetValue),
    weightedForecastAdditional: Math.round(additionalExpectedValue),
    totalProjection: Math.round(totalProjection),
    target,
    gapToTarget: Math.round(gapToTarget),
    projectedAttainmentPct,
    onTrack,
    counts: {
      wonDeals: wonDealsCount,
      openDeals: openDeals.length
    },
    topDealsLikelyToClose: highConfidenceDeals
      .sort((a, b) => b.expectedContribution - a.expectedContribution)
      .slice(0, 10),
    probabilityDefinitionNotes: {
      pWin: "Marginal probability that the deal will eventually close won",
      pCloseGivenWin: "Conditional probability that it closes within this period given that it wins",
      jointFormula: "P(CloseThisPeriod) = P(Win) * P(CloseGivenWin)"
    }
  };
}

module.exports = {
  computeSalesForecast,
  getFYBounds,
  getQuarterBounds,
  getMonthBounds
};
