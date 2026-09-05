/**
 * server/services/ml/featureStoreService.js
 * -----------------------------------------------------------------------
 * Enriched 22-Feature Extraction & Storage Service.
 * Ensures identical feature computation between training & live inference.
 */

const { pool } = require('../../db');

const STAGE_ORDER = [
  'need analysis',
  'solution design',
  'solution approval',
  'quote creation',
  'quote approval',
  'negotiation'
];

function getStageProgress(stageName) {
  if (!stageName) return 0.3;
  const s = stageName.toLowerCase().trim();
  const idx = STAGE_ORDER.findIndex(st => s.includes(st) || st.includes(s));
  if (idx === -1) return 0.35;
  return (idx + 1) / STAGE_ORDER.length;
}

/**
 * Feature Names (20 numeric continuous + scaled features for logistic regression)
 */
const NUMERIC_FEATURE_KEYS = [
  'deal_value_log',
  'stage_progress',
  'stage_age_days',
  'total_deal_age_days',
  'rep_win_rate',
  'industry_win_rate',
  'source_win_rate',
  'clv_log',
  'customer_deal_count',
  'previous_wins',
  'previous_losses',
  'activity_count',
  'comment_count',
  'days_since_activity',
  'proposal_revisions',
  'discount_pct',
  'margin_pct',
  'is_q4',
  'is_q1',
  'month_sin'
];

/**
 * Extract benchmark win rates from closed historical deals.
 */
async function computeCorpusBenchmarks() {
  const repRates = {};
  const indRates = {};
  const srcRates = {};

  try {
    const { rows: repRows } = await pool.query(`
      SELECT 
        COALESCE(sales_rep_name, 'Unassigned') as rep,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'won') as won
      FROM deals
      WHERE status IN ('won', 'lost')
      GROUP BY sales_rep_name
    `);
    repRows.forEach(r => {
      const tot = parseInt(r.total, 10) || 1;
      const won = parseInt(r.won, 10) || 0;
      repRates[r.rep.toLowerCase()] = Math.round((won / tot) * 1000) / 1000;
    });

    const { rows: indRows } = await pool.query(`
      SELECT 
        COALESCE(industry, 'General') as ind,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'won') as won
      FROM deals
      WHERE status IN ('won', 'lost')
      GROUP BY industry
    `);
    indRows.forEach(r => {
      const tot = parseInt(r.total, 10) || 1;
      const won = parseInt(r.won, 10) || 0;
      indRates[r.ind.toLowerCase()] = Math.round((won / tot) * 1000) / 1000;
    });

    const { rows: srcRows } = await pool.query(`
      SELECT 
        COALESCE(lead_source, 'Direct') as src,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'won') as won
      FROM deals
      WHERE status IN ('won', 'lost')
      GROUP BY lead_source
    `);
    srcRows.forEach(r => {
      const tot = parseInt(r.total, 10) || 1;
      const won = parseInt(r.won, 10) || 0;
      srcRates[r.src.toLowerCase()] = Math.round((won / tot) * 1000) / 1000;
    });
  } catch (err) {
    console.warn('[featureStoreService] Benchmarks query note:', err.message);
  }

  return { repRates, indRates, srcRates };
}

/**
 * Extract complete 22-feature vector for a deal object.
 */
function extractFeaturesFromDeal(deal, benchmarks = {}, asOfDate) {
  if (!asOfDate) {
    throw new Error('[extractFeaturesFromDeal] asOfDate is required to prevent temporal leakage');
  }
  const asOf = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  if (isNaN(asOf.getTime())) {
    throw new Error(`[extractFeaturesFromDeal] Invalid asOfDate: ${asOfDate}`);
  }

  const dealValue = Math.max(0, parseFloat(deal.net_revenue || deal.gross_revenue || deal.grossRevenue || '0'));
  const stageName = deal.stage_name || deal.stage || '';
  const stageProgress = getStageProgress(stageName);

  const createdAt = deal.created_at ? new Date(deal.created_at) : (deal.date ? new Date(deal.date) : asOf);
  const totalAgeDays = Math.max(0, Math.round((asOf - createdAt) / (1000 * 60 * 60 * 24)));

  const repKey = (deal.sales_rep_name || deal.salesRep || 'unassigned').toLowerCase().trim();
  const indKey = (deal.industry || 'general').toLowerCase().trim();
  const srcKey = (deal.lead_source || deal.leadSource || 'direct').toLowerCase().trim();

  const repWinRate = benchmarks.repRates?.[repKey] ?? 0.52;
  const indWinRate = benchmarks.indRates?.[indKey] ?? 0.50;
  const srcWinRate = benchmarks.srcRates?.[srcKey] ?? 0.48;

  const clv = Math.max(0, parseFloat(deal.customer_ltv || '0'));
  const custDealCount = parseInt(deal.customer_deal_count || '1', 10) || 1;
  const prevWins = parseInt(deal.previous_wins || '0', 10);
  const prevLosses = parseInt(deal.previous_losses || '0', 10);

  const activityCount = parseInt(deal.activity_count || '0', 10);
  const commentCount = deal.comments && deal.comments.length > 0 ? 1 : 0;
  const daysSinceActivity = Math.min(60, parseInt(deal.days_since_activity || '5', 10));
  const proposalRevisions = parseInt(deal.proposal_revisions || '1', 10);

  const discountPct = Math.max(0, parseFloat(deal.discount_pct || '0'));
  const marginPct = Math.max(0, parseFloat(deal.margin_pct || '20'));

  const month = createdAt.getMonth() + 1; // 1-12
  const quarter = deal.quarter || `Q${Math.ceil(month / 3)}`;

  // Log-transformed scaling for values
  const dealValueLog = Math.log10(dealValue + 1);
  const clvLog = Math.log10(clv + 1);

  const isQ4 = quarter.includes('4') ? 1 : 0;
  const isQ1 = quarter.includes('1') ? 1 : 0;
  const monthSin = Math.sin((2 * Math.PI * month) / 12);

  const vector = [
    dealValueLog,
    stageProgress,
    Math.min(totalAgeDays, 90) / 90, // stage_age proxy
    Math.min(totalAgeDays, 180) / 180,
    repWinRate,
    indWinRate,
    srcWinRate,
    clvLog / 7,
    Math.min(custDealCount, 20) / 20,
    Math.min(prevWins, 10) / 10,
    Math.min(prevLosses, 10) / 10,
    Math.min(activityCount, 15) / 15,
    commentCount,
    Math.min(daysSinceActivity, 30) / 30,
    Math.min(proposalRevisions, 5) / 5,
    Math.min(discountPct, 50) / 50,
    Math.min(marginPct, 50) / 50,
    isQ4,
    isQ1,
    monthSin
  ];

  return {
    raw: {
      deal_value: dealValue,
      stage: stageName,
      stage_progress: stageProgress,
      stage_age_days: totalAgeDays,
      total_deal_age_days: totalAgeDays,
      sales_rep: deal.sales_rep_name || deal.salesRep || 'Unassigned',
      rep_win_rate: repWinRate,
      industry: deal.industry || 'General',
      industry_win_rate: indWinRate,
      lead_source: deal.lead_source || deal.leadSource || 'Direct',
      source_win_rate: srcWinRate,
      customer_lifetime_value: clv,
      customer_deal_count: custDealCount,
      previous_wins: prevWins,
      previous_losses: prevLosses,
      activity_count: activityCount,
      comment_count: commentCount,
      days_since_activity: daysSinceActivity,
      proposal_revisions: proposalRevisions,
      discount_pct: discountPct,
      margin_pct: marginPct,
      quarter,
      month_num: month
    },
    vector
  };
}

/**
 * Persist computed deal features into deal_features_store in PostgreSQL.
 */
async function saveDealFeatures(dealId, featureData, isWon = null, closedAt = null) {
  try {
    const raw = featureData.raw;
    await pool.query(`
      INSERT INTO deal_features_store (
        deal_id, deal_value, stage, stage_progress, stage_age_days, total_deal_age_days,
        sales_rep, rep_win_rate, industry, industry_win_rate, lead_source, source_win_rate,
        customer_lifetime_value, customer_deal_count, previous_wins, previous_losses,
        activity_count, comment_count, days_since_activity, proposal_revisions,
        discount_pct, margin_pct, quarter, month_num, is_won, closed_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, CURRENT_TIMESTAMP
      ) ON CONFLICT (deal_id) DO UPDATE SET
        deal_value = EXCLUDED.deal_value,
        stage = EXCLUDED.stage,
        stage_progress = EXCLUDED.stage_progress,
        stage_age_days = EXCLUDED.stage_age_days,
        total_deal_age_days = EXCLUDED.total_deal_age_days,
        sales_rep = EXCLUDED.sales_rep,
        rep_win_rate = EXCLUDED.rep_win_rate,
        industry = EXCLUDED.industry,
        industry_win_rate = EXCLUDED.industry_win_rate,
        lead_source = EXCLUDED.lead_source,
        source_win_rate = EXCLUDED.source_win_rate,
        customer_lifetime_value = EXCLUDED.customer_lifetime_value,
        customer_deal_count = EXCLUDED.customer_deal_count,
        previous_wins = EXCLUDED.previous_wins,
        previous_losses = EXCLUDED.previous_losses,
        activity_count = EXCLUDED.activity_count,
        comment_count = EXCLUDED.comment_count,
        days_since_activity = EXCLUDED.days_since_activity,
        proposal_revisions = EXCLUDED.proposal_revisions,
        discount_pct = EXCLUDED.discount_pct,
        margin_pct = EXCLUDED.margin_pct,
        quarter = EXCLUDED.quarter,
        month_num = EXCLUDED.month_num,
        is_won = COALESCE(EXCLUDED.is_won, deal_features_store.is_won),
        closed_at = COALESCE(EXCLUDED.closed_at, deal_features_store.closed_at),
        updated_at = CURRENT_TIMESTAMP
    `, [
      dealId, raw.deal_value, raw.stage, raw.stage_progress, raw.stage_age_days, raw.total_deal_age_days,
      raw.sales_rep, raw.rep_win_rate, raw.industry, raw.industry_win_rate, raw.lead_source, raw.source_win_rate,
      raw.customer_lifetime_value, raw.customer_deal_count, raw.previous_wins, raw.previous_losses,
      raw.activity_count, raw.comment_count, raw.days_since_activity, raw.proposal_revisions,
      raw.discount_pct, raw.margin_pct, raw.quarter, raw.month_num, isWon, closedAt
    ]);
  } catch (err) {
    console.warn(`[featureStoreService] Failed to save features for deal ${dealId}:`, err.message);
  }
}

module.exports = {
  NUMERIC_FEATURE_KEYS,
  computeCorpusBenchmarks,
  extractFeaturesFromDeal,
  saveDealFeatures,
  getStageProgress
};
