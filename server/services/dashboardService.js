/**
 * server/services/dashboardService.js
 * -----------------------------------------------------------------------
 * PostgreSQL-Backed SQL Calculation Engine for Compton Executive Dashboard.
 * Translates global filters into performant SQL queries & aggregates.
 */

const { pool } = require('../db');

// ── Target Configurations ───────────────────────────────────────────────

const COMPANY_MONTHLY_TARGET = 16000000; // ₹1.60 Cr
const COMPANY_YEARLY_TARGET = 200000000; // ₹20.00 Cr

const INDIVIDUAL_REP_MONTHLY_TARGETS = {
  'Sandeep Vahi': 3950000,
  'Rohit Yadav': 7500000,
  'Jitesh Chander': 4000000,
  'Taniya Negi': 550000
};

// ── Financial Year Helper ───────────────────────────────────────────────

function getFYBounds(customDate = new Date()) {
  const now = customDate instanceof Date ? customDate : new Date(customDate);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed: 0 = Jan, 3 = Apr

  let fyStartYear = currentYear;
  if (currentMonth < 3) {
    fyStartYear = currentYear - 1;
  }
  const fyEndYear = fyStartYear + 1;

  const start = `${fyStartYear}-04-01`;
  const end = `${fyEndYear}-03-31`;
  return { start, end, fyLabel: `FY ${fyStartYear}-${String(fyEndYear).slice(2)}` };
}

// ── SQL Filter Builder ──────────────────────────────────────────────────

function buildDealWhereClause(filters = {}, prefix = '') {
  const conditions = [];
  const params = [];
  let pIdx = 1;

  const col = (name) => prefix ? `${prefix}.${name}` : name;

  // Date filters apply ONLY to closed deals ('won', 'lost'); in_progress represents all active pipeline till date
  const hasDateFilter = Boolean(
    filters.startDate || filters.endDate || 
    (filters.selectedMonth && filters.selectedMonth !== 'All') ||
    (filters.selectedQuarter && filters.selectedQuarter !== 'All') ||
    (filters.selectedYear && filters.selectedYear !== 'All')
  );

  if (hasDateFilter) {
    const dateConditions = [];

    if (filters.startDate) {
      dateConditions.push(`${col('deal_date')} >= $${pIdx++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      dateConditions.push(`${col('deal_date')} <= $${pIdx++}`);
      params.push(filters.endDate);
    }
    if (filters.selectedMonth && filters.selectedMonth !== 'All') {
      const m = filters.selectedMonth.trim();
      dateConditions.push(`${col('month_year')} ILIKE $${pIdx++}`);
      params.push(`%${m}%`);
    }
    if (filters.selectedQuarter && filters.selectedQuarter !== 'All') {
      dateConditions.push(`${col('quarter')} = $${pIdx++}`);
      params.push(filters.selectedQuarter);
    }
    if (filters.selectedYear && filters.selectedYear !== 'All') {
      dateConditions.push(`${col('year')} = $${pIdx++}`);
      params.push(parseInt(filters.selectedYear, 10));
    }

    const dateFilterSql = dateConditions.join(' AND ');
    conditions.push(`(${col('status')} = 'in_progress' OR (${dateFilterSql}))`);
  }

  // Dimension filters
  if (filters.salesRep && filters.salesRep !== 'All') {
    conditions.push(`${col('sales_rep_name')} = $${pIdx++}`);
    params.push(filters.salesRep);
  }
  if (filters.industry && filters.industry !== 'All') {
    conditions.push(`${col('industry')} = $${pIdx++}`);
    params.push(filters.industry);
  }
  if (filters.solution && filters.solution !== 'All') {
    conditions.push(`${col('solution')} = $${pIdx++}`);
    params.push(filters.solution);
  }
  if (filters.leadSource && filters.leadSource !== 'All') {
    conditions.push(`${col('lead_source')} = $${pIdx++}`);
    params.push(filters.leadSource);
  }
  if (filters.pipelineStage && filters.pipelineStage !== 'All') {
    conditions.push(`${col('stage_name')} = $${pIdx++}`);
    params.push(filters.pipelineStage);
  }

  // Search queries
  if (filters.customerQuery) {
    conditions.push(`${col('customer_name')} ILIKE $${pIdx++}`);
    params.push(`%${filters.customerQuery}%`);
  }
  if (filters.dealQuery) {
    conditions.push(`(${col('bitrix_deal_id')} ILIKE $${pIdx} OR ${col('title')} ILIKE $${pIdx})`);
    pIdx++;
    params.push(`%${filters.dealQuery}%`);
  }
  if (filters.companyQuery) {
    conditions.push(`${col('customer_name')} ILIKE $${pIdx++}`);
    params.push(`%${filters.companyQuery}%`);
  }

  // Deal value bounds
  if (filters.minDealValue) {
    conditions.push(`${col('gross_revenue')} >= $${pIdx++}`);
    params.push(parseFloat(filters.minDealValue));
  }
  if (filters.maxDealValue && parseFloat(filters.maxDealValue) > 0) {
    conditions.push(`${col('gross_revenue')} <= $${pIdx++}`);
    params.push(parseFloat(filters.maxDealValue));
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereSql, params };
}

// ── 1. Summary KPIs ─────────────────────────────────────────────────────

async function getDashboardSummary(filters = {}) {
  const { whereSql, params } = buildDealWhereClause(filters);

  // Main KPI SQL Query with SQL aggregates
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'won') AS total_won_count,
      COUNT(*) FILTER (WHERE status = 'lost') AS total_lost_count,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS total_pipeline_count,
      
      COALESCE(SUM(gross_revenue) FILTER (WHERE status = 'won'), 0) AS won_gross_revenue,
      COALESCE(SUM(net_revenue) FILTER (WHERE status = 'won'), 0) AS won_net_revenue,
      
      COALESCE(SUM(gross_revenue) FILTER (WHERE status = 'lost'), 0) AS lost_gross_revenue,
      COALESCE(SUM(net_revenue) FILTER (WHERE status = 'lost'), 0) AS lost_net_revenue,
      
      COALESCE(SUM(gross_revenue) FILTER (WHERE status = 'in_progress'), 0) AS pipeline_gross_revenue,
      COALESCE(SUM(net_revenue) FILTER (WHERE status = 'in_progress'), 0) AS pipeline_net_revenue,
      COALESCE(SUM(net_revenue * (COALESCE(win_probability, 50) / 100.0)) FILTER (WHERE status = 'in_progress'), 0) AS weighted_pipeline_forecast,
      
      COALESCE(AVG(net_revenue) FILTER (WHERE status = 'won'), 0) AS avg_deal_size,
      COALESCE(MAX(net_revenue) FILTER (WHERE status = 'won'), 0) AS largest_deal_size,
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY net_revenue) FILTER (WHERE status = 'won'), 0) AS median_deal_size,
      
      COALESCE(AVG(sales_cycle_days) FILTER (WHERE status = 'won'), 18) AS avg_sales_cycle_days,
      
      COUNT(DISTINCT month_year) FILTER (WHERE status IN ('won', 'lost')) AS active_closed_months
    FROM deals
    ${whereSql}
  `;

  const { rows } = await pool.query(sql, params);
  const row = rows[0] || {};

  const totalWonCount = parseInt(row.total_won_count || '0', 10);
  const totalLostCount = parseInt(row.total_lost_count || '0', 10);
  const totalDealsInPipeline = parseInt(row.total_pipeline_count || '0', 10);

  const totalGrossRevenue = parseFloat(row.won_gross_revenue || '0');
  const totalNetRevenue = parseFloat(row.won_net_revenue || '0');
  const totalLostValue = parseFloat(row.lost_gross_revenue || '0');

  const pipelineGrossValue = parseFloat(row.pipeline_gross_revenue || '0');
  const pipelineNetValue = parseFloat(row.pipeline_net_revenue || '0');
  const weightedForecast = parseFloat(row.weighted_pipeline_forecast || '0');
  const forecastRevenue = Math.round((totalNetRevenue + weightedForecast) * 100) / 100;

  const avgDealSize = Math.round(parseFloat(row.avg_deal_size || '0'));
  const largestDealSize = parseFloat(row.largest_deal_size || '0');
  const medianDealSize = Math.round(parseFloat(row.median_deal_size || '0'));
  const avgSalesCycleDays = Math.round(parseFloat(row.avg_sales_cycle_days || '18'));

  // Target calculation based on filters & active closed months
  let baseTargetPerMonth = COMPANY_MONTHLY_TARGET;
  let yearlyTarget = COMPANY_YEARLY_TARGET;

  if (filters.salesRep && filters.salesRep !== 'All') {
    baseTargetPerMonth = INDIVIDUAL_REP_MONTHLY_TARGETS[filters.salesRep] || 550000;
    yearlyTarget = baseTargetPerMonth * 12;
  }

  const activeMonths = parseInt(row.active_closed_months || '1', 10) || 1;
  const monthlyTarget = baseTargetPerMonth * activeMonths;
  const targetAchievementPct = monthlyTarget > 0 ? Math.round((totalNetRevenue / monthlyTarget) * 1000) / 10 : 0.0;
  const revenueRemaining = Math.max(0, monthlyTarget - totalNetRevenue);

  // FY Year Achievement
  const fyBounds = getFYBounds();
  const fyRes = await pool.query(
    `SELECT COALESCE(SUM(net_revenue), 0) AS fy_net_revenue
     FROM deals
     WHERE status = 'won' AND deal_date >= $1 AND deal_date <= $2`,
    [fyBounds.start, fyBounds.end]
  );
  const fyNetRevenue = parseFloat(fyRes.rows[0]?.fy_net_revenue || '0');
  const yearlyAchievementPct = yearlyTarget > 0 ? Math.round((fyNetRevenue / yearlyTarget) * 1000) / 10 : 0.0;

  // Win Rate and Loss Rate (by revenue value)
  const totalClosedValue = totalGrossRevenue + totalLostValue;
  const winRatePct = totalClosedValue > 0 ? Math.round((totalGrossRevenue / totalClosedValue) * 1000) / 10 : 0.0;
  const lossRatePct = totalClosedValue > 0 ? Math.round((totalLostValue / totalClosedValue) * 1000) / 10 : 0.0;

  // Pipeline Coverage Ratio
  const pipelineCoverageRatio = revenueRemaining > 0
    ? Math.round((pipelineNetValue / revenueRemaining) * 100) / 100
    : (pipelineNetValue > 0 ? 5.0 : 0.0);

  // Sales cycle trend vs 22-day benchmark
  const benchmarkCycle = 22;
  const cycleDiff = benchmarkCycle - avgSalesCycleDays;
  let salesCycleTrend = totalWonCount > 0 ? 'On Benchmark' : 'No closed deals';
  let salesCycleTrendPositive = true;
  if (totalWonCount > 0) {
    if (cycleDiff > 0) {
      salesCycleTrend = `${cycleDiff} Days faster`;
      salesCycleTrendPositive = true;
    } else if (cycleDiff < 0) {
      salesCycleTrend = `${Math.abs(cycleDiff)} Days slower`;
      salesCycleTrendPositive = false;
    }
  }

  // MoM Revenue Growth
  const momRes = await pool.query(`
    SELECT month_year, SUM(net_revenue) as month_revenue
    FROM deals
    WHERE status = 'won' AND month_year IS NOT NULL
    GROUP BY month_year
    ORDER BY MIN(deal_date) DESC
    LIMIT 2
  `);
  let revenueGrowthPct = 0;
  if (momRes.rows.length >= 2) {
    const currentM = parseFloat(momRes.rows[0].month_revenue || '0');
    const prevM = parseFloat(momRes.rows[1].month_revenue || '0');
    if (prevM > 0) {
      revenueGrowthPct = Math.round(((currentM - prevM) / prevM) * 1000) / 10;
    }
  }

  return {
    totalGrossRevenue,
    totalNetRevenue,
    monthlyTarget,
    targetAchievementPct,
    revenueRemaining,
    yearlyAchievementPct,
    pipelineGrossValue,
    pipelineNetValue,
    totalDealsInPipeline,
    forecastRevenue,
    avgDealSize,
    largestDealSize,
    medianDealSize,
    winRatePct,
    lossRatePct,
    pipelineCoverageRatio,
    avgSalesCycleDays,
    salesCycleTrend,
    salesCycleTrendPositive,
    revenueGrowthPct,
    totalWonCount,
    totalLostCount
  };
}

// ── 2. Revenue Analytics ────────────────────────────────────────────────

async function getRevenueAnalytics(filters = {}) {
  const { whereSql, params } = buildDealWhereClause(filters);

  // Monthly Revenue Trend
  const monthlySql = `
    SELECT
      month_year,
      COALESCE(SUM(net_revenue) FILTER (WHERE status = 'won'), 0) AS won_revenue,
      COALESCE(SUM(gross_revenue) FILTER (WHERE status = 'won'), 0) AS gross_revenue,
      COALESCE(SUM(net_revenue) FILTER (WHERE status = 'in_progress'), 0) AS pipeline_revenue,
      COUNT(*) FILTER (WHERE status = 'won') AS deals_won_count
    FROM deals
    ${whereSql}
    GROUP BY month_year
    ORDER BY MIN(deal_date) ASC
  `;

  // Solution Mix Breakdown
  const solutionSql = `
    SELECT
      solution,
      COALESCE(SUM(net_revenue) FILTER (WHERE status = 'won'), 0) AS revenue,
      COUNT(*) FILTER (WHERE status = 'won') AS deal_count
    FROM deals
    ${whereSql}
    GROUP BY solution
    ORDER BY revenue DESC
  `;

  // Industry Mix Breakdown
  const industrySql = `
    SELECT
      industry,
      COALESCE(SUM(net_revenue) FILTER (WHERE status = 'won'), 0) AS revenue,
      COUNT(*) FILTER (WHERE status = 'won') AS deal_count
    FROM deals
    ${whereSql}
    GROUP BY industry
    ORDER BY revenue DESC
  `;

  const [monthlyRes, solutionRes, industryRes] = await Promise.all([
    pool.query(monthlySql, params),
    pool.query(solutionSql, params),
    pool.query(industrySql, params)
  ]);

  return {
    monthlyTrends: monthlyRes.rows,
    solutionBreakdown: solutionRes.rows,
    industryBreakdown: industryRes.rows
  };
}

// ── 3. Pipeline Analytics ───────────────────────────────────────────────

async function getPipelineAnalytics(filters = {}) {
  const { whereSql, params } = buildDealWhereClause(filters);

  // Pipeline Stage Distribution
  const stageSql = `
    SELECT
      stage_name,
      COUNT(*) as deal_count,
      COALESCE(SUM(gross_revenue), 0) as gross_value,
      COALESCE(SUM(net_revenue), 0) as net_value,
      COALESCE(SUM(net_revenue * (COALESCE(win_probability, 50) / 100.0)), 0) as weighted_value,
      AVG(sales_cycle_days) as avg_days_in_stage
    FROM deals
    ${whereSql}
    GROUP BY stage_name
    ORDER BY MAX(win_probability) ASC
  `;

  const { rows: stageDistribution } = await pool.query(stageSql, params);

  return {
    stageDistribution
  };
}

// ── 4. Win Rate Analytics ───────────────────────────────────────────────

async function getWinRateAnalytics(filters = {}) {
  const { whereSql, params } = buildDealWhereClause(filters);

  // Win Rate by Representative
  const repSql = `
    SELECT
      sales_rep_name,
      COUNT(*) FILTER (WHERE status = 'won') as won_count,
      COUNT(*) FILTER (WHERE status = 'lost') as lost_count,
      COALESCE(SUM(gross_revenue) FILTER (WHERE status = 'won'), 0) as won_value,
      COALESCE(SUM(gross_revenue) FILTER (WHERE status = 'lost'), 0) as lost_value
    FROM deals
    ${whereSql}
    GROUP BY sales_rep_name
    HAVING (COUNT(*) FILTER (WHERE status IN ('won', 'lost'))) > 0
    ORDER BY won_value DESC
  `;

  // Lost Reasons Breakdown
  const lostReasonSql = `
    SELECT
      COALESCE(lost_reason, 'Unspecified / Competitor') as reason,
      COUNT(*) as count,
      COALESCE(SUM(gross_revenue), 0) as lost_value
    FROM deals
    WHERE status = 'lost'
    GROUP BY reason
    ORDER BY lost_value DESC
  `;

  const [repRes, lostRes] = await Promise.all([
    pool.query(repSql, params),
    pool.query(lostReasonSql)
  ]);

  const repPerformance = repRes.rows.map(r => {
    const wonVal = parseFloat(r.won_value || '0');
    const lostVal = parseFloat(r.lost_value || '0');
    const totalVal = wonVal + lostVal;
    const winRate = totalVal > 0 ? Math.round((wonVal / totalVal) * 1000) / 10 : 0;
    return {
      salesRep: r.sales_rep_name,
      wonCount: parseInt(r.won_count || '0', 10),
      lostCount: parseInt(r.lost_count || '0', 10),
      wonValue: wonVal,
      lostValue: lostVal,
      winRatePct: winRate
    };
  });

  return {
    repPerformance,
    lostReasons: lostRes.rows
  };
}

// ── 5. Sales Rep Leaderboard Analytics ──────────────────────────────────

async function getSalesRepAnalytics(filters = {}) {
  // NOTE: filters.salesRep was previously accepted but silently ignored —
  // buildDealWhereClause() only understands date filters, so a "single rep"
  // request always returned every rep. Filter explicitly by name here instead.
  const repConditions = [];
  const repParams = [];
  if (filters.salesRep) {
    repParams.push(`%${filters.salesRep}%`);
    repConditions.push(`r.name ILIKE $${repParams.length}`);
  }
  const repWhereSql = repConditions.length > 0 ? `WHERE ${repConditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      r.id,
      r.name as sales_rep_name,
      r.monthly_target,
      r.yearly_target,
      r.avatar_url,
      COALESCE(SUM(d.net_revenue) FILTER (WHERE d.status = 'won'), 0) as won_revenue,
      COALESCE(SUM(d.net_revenue) FILTER (WHERE d.status = 'in_progress'), 0) as pipeline_revenue,
      COUNT(d.id) FILTER (WHERE d.status = 'won') as won_count,
      COUNT(d.id) FILTER (WHERE d.status = 'lost') as lost_count,
      COUNT(d.id) FILTER (WHERE d.status = 'in_progress') as pipeline_count
    FROM sales_reps r
    LEFT JOIN deals d ON d.sales_rep_id = r.id
    ${repWhereSql}
    GROUP BY r.id, r.name, r.monthly_target, r.yearly_target, r.avatar_url
    ORDER BY won_revenue DESC
  `;

  const { rows } = await pool.query(sql, repParams);

  const reps = rows.map(r => {
    const wonRev = parseFloat(r.won_revenue || '0');
    const mTarget = parseFloat(r.monthly_target || '550000');
    const achievementPct = mTarget > 0 ? Math.round((wonRev / mTarget) * 1000) / 10 : 0;
    return {
      id: r.id,
      name: r.sales_rep_name,
      avatarUrl: r.avatar_url,
      monthlyTarget: mTarget,
      yearlyTarget: parseFloat(r.yearly_target || '6600000'),
      wonRevenue: wonRev,
      pipelineRevenue: parseFloat(r.pipeline_revenue || '0'),
      wonCount: parseInt(r.won_count || '0', 10),
      lostCount: parseInt(r.lost_count || '0', 10),
      pipelineCount: parseInt(r.pipeline_count || '0', 10),
      totalRevenue: wonRev,
      achievementPct
    };
  });

  // Ranked leaderboard is the whole point of this endpoint when no single
  // rep was requested — surface the top/bottom explicitly so the chatbot
  // doesn't have to re-derive "highest revenue" from a raw array itself.
  return {
    reps,
    leaderboardByRevenue: [...reps].sort((a, b) => b.wonRevenue - a.wonRevenue).map(r => ({ name: r.name, wonRevenue: r.wonRevenue })),
    topRepByRevenue: reps.length > 0 ? reps.reduce((top, r) => (r.wonRevenue > (top?.wonRevenue ?? -1) ? r : top), null) : null
  };
}

// ── 6. Project Delivery Analytics (Google Sheets) ───────────────────────

async function getProjectAnalytics(filters = {}) {
  const conditions = [];
  const params = [];
  let pIdx = 1;

  if (filters.status && filters.status !== 'All') {
    conditions.push(`status = $${pIdx++}`);
    params.push(filters.status);
  }
  if (filters.customerQuery) {
    conditions.push(`customer_name ILIKE $${pIdx++}`);
    params.push(`%${filters.customerQuery}%`);
  }
  if (filters.projectType && filters.projectType !== 'All') {
    conditions.push(`project_type = $${pIdx++}`);
    params.push(filters.projectType);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const summarySql = `
    SELECT
      COUNT(*) as total_projects,
      COUNT(*) FILTER (WHERE status = 'Running') as running_count,
      COUNT(*) FILTER (WHERE status = 'Completed') as completed_count,
      COUNT(*) FILTER (WHERE status = 'Delayed') as delayed_count,
      COUNT(*) FILTER (WHERE status = 'On Hold') as on_hold_count,
      
      COALESCE(SUM(planned_budget), 0) as total_planned_budget,
      COALESCE(SUM(actual_cost), 0) as total_actual_cost,
      COALESCE(SUM(budget_variance), 0) as total_budget_variance,
      
      COALESCE(AVG(delay_days), 0) as avg_delay_days
    FROM projects
    ${whereSql}
  `;

  const listSql = `
    SELECT * FROM projects
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT 100
  `;

  const [summaryRes, listRes] = await Promise.all([
    pool.query(summarySql, params),
    pool.query(listSql, params)
  ]);

  const sumRow = summaryRes.rows[0] || {};
  const planned = parseFloat(sumRow.total_planned_budget || '0');
  const actual = parseFloat(sumRow.total_actual_cost || '0');
  const variance = parseFloat(sumRow.total_budget_variance || '0');
  const variancePct = planned > 0 ? Math.round((variance / planned) * 1000) / 10 : 0.0;

  return {
    kpis: {
      totalProjects: parseInt(sumRow.total_projects || '0', 10),
      runningCount: parseInt(sumRow.running_count || '0', 10),
      completedCount: parseInt(sumRow.completed_count || '0', 10),
      delayedCount: parseInt(sumRow.delayed_count || '0', 10),
      onHoldCount: parseInt(sumRow.on_hold_count || '0', 10),
      totalPlannedBudget: planned,
      totalActualCost: actual,
      totalBudgetVariance: variance,
      budgetVariancePct: variancePct,
      avgDelayDays: Math.round(parseFloat(sumRow.avg_delay_days || '0'))
    },
    projects: listRes.rows
  };
}

module.exports = {
  getDashboardSummary,
  getRevenueAnalytics,
  getPipelineAnalytics,
  getWinRateAnalytics,
  getSalesRepAnalytics,
  getProjectAnalytics
};