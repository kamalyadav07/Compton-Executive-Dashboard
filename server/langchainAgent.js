/**
 * server/langchainAgent.js
 * -----------------------------------------------------------------------
 * LangChain AI Copilot Engine for Compton Dashboard.
 * Powered by @langchain/google-genai, @langchain/langgraph/prebuilt, and @langchain/core.
 *
 * HARD RULE: The LLM NEVER calculates or invents any number. It strictly
 * calls deterministic tools (get_sales_projection, get_deals_likely_to_close,
 * get_rep_performance, get_deal_detail, query_deals) that run real TS code
 * against live synced Bitrix data, and converts JSON tool output into natural
 * conversational responses.
 */

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { DynamicStructuredTool } = require('@langchain/core/tools');
const { createReactAgent } = require('@langchain/langgraph/prebuilt');
const { MemorySaver } = require('@langchain/langgraph');
const { z } = require('zod');

// Auto-compiled from src/engine/*.ts by `node build-engines.mjs`
const { computeSalesProjection } = require('./engines/salesProjectionEngine');
const { runDealIntelligence, computeRealAgeDays, computeRealDaysSinceUpdate } = require('./engines/dealIntelligenceEngine');
const { splitGst } = require('./engines/financeUtils');
const { cleanDealTitle } = require('./engines/textUtils');
const { getTargets } = require('./salesTargets');

function getCachedDeals(cache) {
  const won = cache.won || [];
  const lost = cache.lost || [];
  const progress = cache.progress || [];
  const deals = [...won, ...lost, ...progress];
  if (deals.length === 0) throw new Error('Data not yet synced — try again in a few seconds.');
  return deals;
}

/**
 * Resolve relative period concepts or specific YYYY-MM months to concrete server-side Date boundaries using current clock.
 */
function resolvePeriodBounds(relativePeriod, specificMonth, asOf = new Date()) {
  const currentYear = asOf.getFullYear();
  const currentMonth = asOf.getMonth(); // 0-indexed

  // 1. If specificMonth is provided (e.g. "2026-07" or "2026-7")
  if (specificMonth && typeof specificMonth === 'string') {
    const match = specificMonth.trim().match(/^(\d{4})[-/.](\d{1,2})$/);
    if (match) {
      const y = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1; // 0-indexed
      if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
        const start = new Date(y, m, 1, 0, 0, 0, 0);
        const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
        return { start, end, label: specificMonth };
      }
    }
  }

  // 2. Relative periods
  if (relativePeriod === 'this_month') {
    const start = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
    const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    return { start, end, label: 'this_month' };
  }
  if (relativePeriod === 'last_month') {
    const start = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
    const end = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    return { start, end, label: 'last_month' };
  }
  if (relativePeriod === 'this_year') {
    const start = new Date(currentYear, 0, 1, 0, 0, 0, 0);
    const end = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    return { start, end, label: 'this_year' };
  }
  if (relativePeriod === 'this_fy') {
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const start = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
    const end = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999);
    return { start, end, label: 'this_fy' };
  }
  if (relativePeriod === 'last_7_days') {
    const start = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    return { start, end: asOf, label: 'last_7_days' };
  }
  if (relativePeriod === 'last_30_days') {
    const start = new Date(asOf.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    return { start, end: asOf, label: 'last_30_days' };
  }
  return null;
}

function buildTools(cache) {
  const getSalesProjectionTool = new DynamicStructuredTool({
    name: 'get_sales_projection',
    description:
      'Get the company sales projection: revenue booked so far, open pipeline value, ' +
      'a weighted forecast of what will realistically close, total projected revenue, ' +
      'gap to target, and the specific deals most likely to close soon. ' +
      'Use this for ANY question about projections, targets, "will we hit our number", ' +
      'monthly or yearly performance, or "how are we doing this month/year".',
    schema: z.object({
      scope: z.enum(['month', 'fy']).describe('"month" for this calendar month, "fy" for the financial year (Apr 1 – Mar 31)')
    }),
    func: async ({ scope }) => {
      const deals = getCachedDeals(cache);
      const targets = getTargets();
      const projection = computeSalesProjection(deals, scope, targets);
      return JSON.stringify(projection);
    }
  });

  const getDealCloseLikelihoodTool = new DynamicStructuredTool({
    name: 'get_deals_likely_to_close',
    description:
      'List open deals ranked by probability of closing within a given number of days. ' +
      'Use for questions like "deals closing this week", "deals likely to close by [date]", ' +
      'or "what should I focus on closing".',
    schema: z.object({
      withinDays: z.number().describe('7 for "this week", 15 for "next 15 days", etc.'),
      salesRepFilter: z.string().optional().describe('Filter to one sales rep by name, if the user asked about a specific person')
    }),
    func: async ({ withinDays, salesRepFilter }) => {
      const deals = getCachedDeals(cache);
      const { results } = runDealIntelligence(deals);
      const key = withinDays <= 7 ? 'closesWithin7DaysPct' : 'closesWithin15DaysPct';
      let filtered = results;
      if (salesRepFilter) {
        filtered = filtered.filter(r => r.deal.salesRep.toLowerCase().includes(salesRepFilter.toLowerCase()));
      }
      const ranked = filtered
        .sort((a, b) => b[key] - a[key])
        .slice(0, 15)
        .map(r => ({
          dealId: r.deal.id,
          id: r.deal.id,
          dealName: cleanDealTitle(r.deal.rawRecord?.TITLE || `${r.deal.customer}`),
          company: r.deal.customer,
          salesRep: r.deal.salesRep || 'Unassigned',
          netValue: splitGst(r.deal.grossRevenue, true).netRevenue,
          winProbabilityPct: r.winProbabilityPct,
          closeLikelihoodPct: r[key],
          expectedCloseDate: r.expectedCloseDate,
          confidenceNote: r.confidenceNote
        }));
      return JSON.stringify(ranked);
    }
  });

  const getRepPerformanceTool = new DynamicStructuredTool({
    name: 'get_rep_performance',
    description: 'Get a sales rep\'s performance: monthly target, monthly booked revenue, target attainment %, all-time won/lost deals, win rate, total revenue, average deal size, and open pipeline.',
    schema: z.object({ repName: z.string() }),
    func: async ({ repName }) => {
      const deals = getCachedDeals(cache);
      const mine = deals.filter(d => d.salesRep.toLowerCase().includes(repName.toLowerCase()));
      const won = mine.filter(d => d.type === 'won');
      const lost = mine.filter(d => d.type === 'lost');
      const open = mine.filter(d => d.type === 'in_progress');

      const bounds = resolvePeriodBounds('this_month');
      const wonThisMonth = won.filter(d => {
        const rawDate = d.rawRecord?.CLOSEDATE || d.rawRecord?.DATE_MODIFY || d.date;
        if (!rawDate) return false;
        const dDate = new Date(rawDate);
        return dDate >= bounds.start && dDate <= bounds.end;
      });
      const monthRevenue = wonThisMonth.reduce((s, d) => s + splitGst(d.grossRevenue, true).netRevenue, 0);

      const totalRevenue = won.reduce((s, d) => s + splitGst(d.grossRevenue, true).netRevenue, 0);

      const { INDIVIDUAL_REP_MONTHLY_TARGETS } = require('./salesTargets');
      const repKey = Object.keys(INDIVIDUAL_REP_MONTHLY_TARGETS).find(k => k.toLowerCase().includes(repName.toLowerCase())) || '';
      const monthlyTarget = repKey ? INDIVIDUAL_REP_MONTHLY_TARGETS[repKey] : 0;
      const targetAttainmentPct = monthlyTarget > 0 ? Math.round((monthRevenue / monthlyTarget) * 100) : null;

      return JSON.stringify({
        repName: repKey || repName,
        monthlyTarget,
        monthBookedRevenue: Math.round(monthRevenue),
        targetAttainmentPct,
        totalRevenueAllTime: Math.round(totalRevenue),
        dealsWonAllTime: won.length,
        dealsLostAllTime: lost.length,
        winRatePct: (won.length + lost.length) > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
        avgDealSize: won.length > 0 ? Math.round(totalRevenue / won.length) : 0,
        openPipelineCount: open.length,
        openPipelineValue: Math.round(open.reduce((s, d) => s + splitGst(d.grossRevenue, true).netRevenue, 0))
      });
    }
  });

  const getDealDetailTool = new DynamicStructuredTool({
    name: 'get_deal_detail',
    description:
      'Get full detail on ONE specific deal by name, company, or Bitrix deal ID (e.g. "BITRIX-3668", "deal 4406") — including ' +
      'its win probability, close likelihood, comments, and any linked quote/document text if already indexed. ' +
      'Use this ONLY when the user asks about ONE specific named deal or deal ID. ' +
      'DO NOT use this for listing multiple deals or "recently won deals" for a company — use query_deals instead for list questions.',
    schema: z.object({ query: z.string().describe('deal name, company name, or Bitrix ID') }),
    func: async ({ query }) => {
      const deals = getCachedDeals(cache);
      const match = deals.find(d =>
        String(d.id) === query ||
        String(d.rawRecord?.TITLE || '').toLowerCase().includes(query.toLowerCase()) ||
        d.customer.toLowerCase().includes(query.toLowerCase())
      );
      if (!match) return JSON.stringify({ found: false, message: `No deal matched "${query}"` });

      const { results } = runDealIntelligence(deals);
      const intel = results.find(r => r.deal.id === match.id);

      const { searchDealDocuments, getDocumentSummaryForDeal } = require('./documentStore');
      const docSummary = getDocumentSummaryForDeal(match.id);
      const docSearchResults = await searchDealDocuments(
        match.id,
        `${match.customer} ${match.rawRecord?.TITLE || ''} quote price scope terms installation warranty`,
        3
      );

      return JSON.stringify({
        found: true,
        dealId: match.id,
        id: match.id,
        dealName: cleanDealTitle(match.rawRecord?.TITLE || `${match.customer}`),
        company: match.customer,
        salesRep: match.salesRep || 'Unassigned',
        stage: match.stage,
        netValue: splitGst(match.grossRevenue, true).netRevenue,
        comments: match.comments || 'No comments logged',
        baseWinProbabilityPct: intel?.baseWinProbabilityPct ?? intel?.winProbabilityPct ?? null,
        winProbabilityPct: intel?.winProbabilityPct ?? null,
        analogousWinRate: intel?.analogousWinRate ?? null,
        analogousDeals: intel?.analogousDeals ? intel.analogousDeals.slice(0, 5).map(a => ({
          dealId: a.dealId,
          customer: a.customer,
          dealTitle: a.dealTitle,
          outcome: a.outcome,
          netValue: a.netRevenue,
          similarityScore: a.similarityScore,
          matchReason: a.reason
        })) : [],
        qualitativeRiskFlags: intel?.ensembleScore?.activeSignals?.map(s => s.label) || [],
        ensembleExplanation: intel?.ensembleScore?.explanation || null,
        closesWithin7DaysPct: intel?.closesWithin7DaysPct ?? null,
        closesWithin15DaysPct: intel?.closesWithin15DaysPct ?? null,
        expectedCloseDate: intel?.expectedCloseDate ?? null,
        documentSummary: docSummary || 'No attached documents indexed for this deal.',
        relevantDocumentChunks: docSearchResults.matches && docSearchResults.matches.length > 0 ? docSearchResults.matches : []
      });
    }
  });

  const searchDealDocumentsTool = new DynamicStructuredTool({
    name: 'search_deal_documents',
    description:
      'Search inside attached PDF, Word (.docx), or Excel (.xlsx) quotes/documents for a specific deal. ' +
      'Use this when the user asks what is inside a deal\'s quote, whether a quote includes a specific item/service ' +
      '(e.g. "does [deal]\'s quote include installation cost"), or asks for specific terms/pricing from attached files.',
    schema: z.object({
      dealId: z.string().describe('Bitrix deal ID (e.g. "BITRIX-64" or "64")'),
      question: z.string().describe('The specific question or keyword search (e.g. "installation cost", "warranty terms", "line items")')
    }),
    func: async ({ dealId, question }) => {
      const deals = getCachedDeals(cache);
      const match = deals.find(d => String(d.id).toLowerCase() === String(dealId).toLowerCase());
      const { searchDealDocuments } = require('./documentStore');
      const results = await searchDealDocuments(dealId, question, 5);
      return JSON.stringify({
        dealId: match?.id || dealId,
        salesRep: match?.salesRep || 'Unassigned',
        dealName: cleanDealTitle(match?.rawRecord?.TITLE || match?.customer || dealId),
        company: match?.customer || '',
        ...results
      });
    }
  });

  // Fixed, auditable set of field names the LLM may use.
  const DIRECT_FIELDS = [
    'id', 'customer', 'grossRevenue', 'netRevenue', 'salesRep',
    'industry', 'solution', 'leadSource', 'stage', 'date', 'monthYear',
    'year', 'quarter', 'type', 'lostReason', 'winProbability',
    'salesCycleDays', 'comments'
  ];
  const DERIVED_FIELDS = ['ageDays', 'daysSinceLastUpdate'];
  const ALL_FIELDS = [...DIRECT_FIELDS, ...DERIVED_FIELDS];

  const OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains'];
  const AGGREGATES = ['count', 'sum_netRevenue', 'avg_netRevenue', 'sum_grossRevenue', 'avg_grossRevenue', 'min_netRevenue', 'max_netRevenue'];

  /** Resolve a field value for a deal — direct lookup or derived computation. */
  function resolveField(deal, fieldName) {
    if (fieldName === 'ageDays') return computeRealAgeDays(deal);
    if (fieldName === 'daysSinceLastUpdate') return computeRealDaysSinceUpdate(deal);
    return deal[fieldName];
  }

  /** Safe compare: apply operator, type-coerce as needed. */
  function applyOperator(fieldVal, operator, testVal) {
    if (fieldVal === undefined || fieldVal === null) {
      if (operator === 'eq') return testVal === '' || testVal === null;
      if (operator === 'neq') return testVal !== '' && testVal !== null;
      return false;
    }

    if (operator === 'contains') {
      return String(fieldVal).toLowerCase().includes(String(testVal).toLowerCase());
    }
    if (operator === 'not_contains') {
      return !String(fieldVal).toLowerCase().includes(String(testVal).toLowerCase());
    }

    const numField = typeof fieldVal === 'number' ? fieldVal : parseFloat(fieldVal);
    const numTest = typeof testVal === 'number' ? testVal : parseFloat(testVal);
    const isNumeric = !isNaN(numField) && !isNaN(numTest);

    if (isNumeric) {
      switch (operator) {
        case 'eq':  return numField === numTest;
        case 'neq': return numField !== numTest;
        case 'gt':  return numField > numTest;
        case 'gte': return numField >= numTest;
        case 'lt':  return numField < numTest;
        case 'lte': return numField <= numTest;
      }
    }

    const strField = String(fieldVal).toLowerCase();
    const strTest = String(testVal).toLowerCase();
    if (operator === 'eq') return strField === strTest;
    if (operator === 'neq') return strField !== strTest;

    return false;
  }

  const queryDealsTool = new DynamicStructuredTool({
    name: 'query_deals',
    description:
      'Flexible query tool to filter, sort, and aggregate the FULL synced deal list. ' +
      'Use this for ANY question about deal lists, recent deals, counts, averages, or ad-hoc filtering — ' +
      'e.g. "list deals won this month", "avg deal size in August", "deals won in July", "capri recently won deals", "stale deals". ' +
      'CRITICAL FOR DATES: For relative concepts ("this month", "last month", "this year"), pass relativePeriod ("this_month" | "last_month" | "this_year" | "this_fy" | "last_7_days" | "last_30_days"). ' +
      'For SPECIFIC named months ("July", "in June", "May 2026"), pass specificMonth in "YYYY-MM" format (e.g. "2026-07" for July 2026, "2026-06" for June 2026) calculated relative to current date. ' +
      'Do NOT pass freeform date strings in the filters array for date/month questions. ' +
      'Valid filter fields: ' + ALL_FIELDS.join(', ') + '. ' +
      'Operators: eq, neq, gt, gte, lt, lte, contains, not_contains. ' +
      'Aggregates: ' + AGGREGATES.join(', ') + ' (or null for raw list).',
    schema: z.object({
      relativePeriod: z.enum(['this_month', 'last_month', 'this_year', 'this_fy', 'last_7_days', 'last_30_days'])
        .optional()
        .describe('Relative period concept. Resolved server-side. Use "this_month" for "this month", "last_month" for "last month", etc.'),
      specificMonth: z.string()
        .optional()
        .describe('Specific calendar month in "YYYY-MM" format (e.g. "2026-07" for July 2026, "2026-06" for June 2026, "2026-05" for May 2026). Always use this when a specific month is named by user.'),
      filters: z.array(z.object({
        field: z.string().describe('Field name from: ' + ALL_FIELDS.join(', ')),
        operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains']),
        value: z.string().describe('The value to compare against (as a string or numeric string, e.g. "10", "Healthcare", "500000")')
      })).optional().default([]).describe('Array of filter conditions — all are ANDed together'),
      sortBy: z.string().optional().default('date').describe('Field to sort by (defaults to "date")'),
      sortOrder: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort order (defaults to "desc" for most recent first)'),
      limit: z.number().optional().default(50).describe('Max results to return (default 50, max 50)'),
      aggregate: z.enum(['count', 'sum_netRevenue', 'avg_netRevenue', 'sum_grossRevenue', 'avg_grossRevenue', 'min_netRevenue', 'max_netRevenue'])
        .optional()
        .describe('Aggregate function — if set, returns a single summary number instead of a list')
    }),
    func: async ({ relativePeriod, specificMonth, filters = [], sortBy = 'date', sortOrder = 'desc', limit = 50, aggregate }) => {
      console.log(`[QUERY_DEALS RECEIVED ARGS] relativePeriod: ${relativePeriod} | specificMonth: ${specificMonth} | aggregate: ${aggregate} | filters:`, JSON.stringify(filters));
      const deals = getCachedDeals(cache);

      // Filter out freeform date filters if relativePeriod or specificMonth is provided
      let effectiveFilters = filters || [];
      if (relativePeriod || specificMonth) {
        effectiveFilters = effectiveFilters.filter(f => f.field !== 'date' && f.field !== 'monthYear' && f.field !== 'year' && f.field !== 'quarter');
      }

      // Validate all filter field names
      for (const f of effectiveFilters) {
        if (!ALL_FIELDS.includes(f.field)) {
          return JSON.stringify({
            error: true,
            message: `Invalid filter field "${f.field}". Valid fields are: ${ALL_FIELDS.join(', ')}`
          });
        }
      }

      const activeSortBy = sortBy || 'date';
      const activeSortOrder = sortOrder || 'desc';

      if (activeSortBy && !ALL_FIELDS.includes(activeSortBy)) {
        return JSON.stringify({
          error: true,
          message: `Invalid sortBy field "${activeSortBy}". Valid fields are: ${ALL_FIELDS.join(', ')}`
        });
      }

      // ── Apply relativePeriod / specificMonth date filter (server-side resolution using real clock) ──
      let matched = deals;
      let periodNote = null;
      if (relativePeriod || specificMonth) {
        const bounds = resolvePeriodBounds(relativePeriod, specificMonth);
        if (bounds) {
          const formatDateLocal = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          periodNote = `${bounds.label} (${formatDateLocal(bounds.start)} to ${formatDateLocal(bounds.end)})`;
          matched = matched.filter(d => {
            const rawDate = d.rawRecord?.CLOSEDATE || d.rawRecord?.DATE_MODIFY || d.date;
            if (!rawDate) return false;
            let dDate;
            if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) {
              dDate = new Date(rawDate.trim() + 'T12:00:00');
            } else {
              dDate = new Date(rawDate);
            }
            if (isNaN(dDate.getTime())) return false;
            return dDate >= bounds.start && dDate <= bounds.end;
          });
        }
      }

      // ── Apply filters (ANDed) ──
      matched = matched.filter(deal => {
        return effectiveFilters.every(f => {
          const fieldVal = resolveField(deal, f.field);
          return applyOperator(fieldVal, f.operator, f.value);
        });
      });

      // ── Aggregate mode ──
      if (aggregate) {
        let result;
        switch (aggregate) {
          case 'count':
            result = matched.length;
            break;
          case 'sum_netRevenue':
            result = Math.round(matched.reduce((s, d) => s + splitGst(d.grossRevenue, d.type === 'won').netRevenue, 0));
            break;
          case 'avg_netRevenue':
            result = matched.length > 0
              ? Math.round(matched.reduce((s, d) => s + splitGst(d.grossRevenue, d.type === 'won').netRevenue, 0) / matched.length)
              : 0;
            break;
          case 'sum_grossRevenue':
            result = Math.round(matched.reduce((s, d) => s + d.grossRevenue, 0));
            break;
          case 'avg_grossRevenue':
            result = matched.length > 0
              ? Math.round(matched.reduce((s, d) => s + d.grossRevenue, 0) / matched.length)
              : 0;
            break;
          case 'min_netRevenue':
            result = matched.length > 0
              ? Math.round(Math.min(...matched.map(d => splitGst(d.grossRevenue, d.type === 'won').netRevenue)))
              : 0;
            break;
          case 'max_netRevenue':
            result = matched.length > 0
              ? Math.round(Math.max(...matched.map(d => splitGst(d.grossRevenue, d.type === 'won').netRevenue)))
              : 0;
            break;
        }
        return JSON.stringify({
          relativePeriodApplied: periodNote,
          aggregate,
          matchedCount: matched.length,
          result
        });
      }

      // ── Sort FIRST before slicing (defaults to date desc) ──
      matched.sort((a, b) => {
        if (activeSortBy === 'date') {
          const da = new Date(a.rawRecord?.CLOSEDATE || a.rawRecord?.DATE_MODIFY || a.date || 0).getTime();
          const db = new Date(b.rawRecord?.CLOSEDATE || b.rawRecord?.DATE_MODIFY || b.date || 0).getTime();
          return activeSortOrder === 'asc' ? da - db : db - da;
        }
        const va = resolveField(a, activeSortBy);
        const vb = resolveField(b, activeSortBy);
        const na = typeof va === 'number' ? va : parseFloat(va) || 0;
        const nb = typeof vb === 'number' ? vb : parseFloat(vb) || 0;
        if (!isNaN(na) && !isNaN(nb)) return activeSortOrder === 'asc' ? na - nb : nb - na;
        return activeSortOrder === 'asc'
          ? String(va || '').localeCompare(String(vb || ''))
          : String(vb || '').localeCompare(String(va || ''));
      });

      // ── Limit SECOND after sorting ──
      const effectiveLimit = Math.min(Math.max(1, limit || 50), 50);
      const totalMatched = matched.length;
      matched = matched.slice(0, effectiveLimit);

      // ── Format output ──
      const rows = matched.map(d => {
        const { netRevenue } = splitGst(d.grossRevenue, d.type === 'won');
        return {
          dealId: d.id,
          id: d.id,
          dealName: cleanDealTitle(d.rawRecord?.TITLE || d.customer),
          customer: d.customer,
          salesRep: d.salesRep || 'Unassigned',
          type: d.type,
          stage: d.stage,
          grossRevenue: d.grossRevenue,
          netRevenue: Math.round(netRevenue),
          industry: d.industry,
          solution: d.solution,
          leadSource: d.leadSource,
          date: d.date,
          quarter: d.quarter,
          year: d.year,
          lostReason: d.lostReason || null,
          comments: d.comments ? d.comments.substring(0, 200) : null,
          ageDays: computeRealAgeDays(d),
          daysSinceLastUpdate: computeRealDaysSinceUpdate(d),
          salesCycleDays: d.salesCycleDays || null
        };
      });

      const showingNote = totalMatched > rows.length
        ? `Showing top ${rows.length} of ${totalMatched} matching deals. Ask for more if needed.`
        : `Showing all ${totalMatched} matching deals.`;

      return JSON.stringify({
        relativePeriodApplied: periodNote,
        totalMatched,
        returned: rows.length,
        showingNote,
        deals: rows
      });
    }
  });

  const getForecastCalibrationTool = new DynamicStructuredTool({
    name: 'get_forecast_calibration',
    description:
      'Get predictive model accuracy, prediction tracking, and probability calibration report across deal buckets (0-20%, 20-40%, 40-60%, 60-80%, 80-100%). ' +
      'Use this when leadership asks "how accurate are our predictions?", "is our win probability model reliable?", or "show forecast calibration".',
    schema: z.object({}),
    func: async () => {
      const deals = getCachedDeals(cache);
      const { computeCalibrationReport } = require('./calibrationEngine');
      return JSON.stringify(computeCalibrationReport(deals));
    }
  });

  const rawTools = [
    getSalesProjectionTool,
    getDealCloseLikelihoodTool,
    getRepPerformanceTool,
    getDealDetailTool,
    searchDealDocumentsTool,
    queryDealsTool,
    getForecastCalibrationTool
  ];
  return rawTools.map(tool => {
    const originalFunc = tool.func;
    tool.func = async (args) => {
      const toolStart = Date.now();
      console.log(`[TOOL CALL START] ${tool.name} | args:`, JSON.stringify(args));
      try {
        const result = await originalFunc(args);
        const duration = Date.now() - toolStart;
        console.log(`[TOOL CALL FINISH] ${tool.name} | duration: ${duration}ms | output len: ${result ? result.length : 0}`);
        console.log(`[TOOL RAW OUTPUT] ${tool.name} | sample:`, typeof result === 'string' ? result.slice(0, 300) : JSON.stringify(result).slice(0, 300));
        return result;
      } catch (err) {
        const duration = Date.now() - toolStart;
        console.error(`[TOOL CALL ERROR] ${tool.name} | duration: ${duration}ms | error:`, err.message);
        throw err;
      }
    };
    return tool;
  });
}

function getSystemPrompt() {
  const currentDate = new Date().toISOString();
  return `You are the AI Sales & Deal Copilot for Compton's leadership dashboard.

IMPORTANT DATE SYSTEM RULE:
Today's real date is provided to you as ${currentDate} — always use it for any relative date reasoning in your response text (e.g. when saying which month you're describing). Never guess or assume a date.

TOOL SELECTION GUIDE:
• get_sales_projection → projections, targets, "will we hit our number", monthly/yearly performance
• get_deals_likely_to_close → deals ranked by close probability within N days
• get_rep_performance → a specific sales rep's stats (deals won/lost, revenue, pipeline)
• get_deal_detail → full detail on ONE specific named deal or deal ID (e.g. "BITRIX-3668", "deal 4406"). DO NOT use this for listing multiple deals or "recently won deals" for a company — use query_deals instead for list questions.
• search_deal_documents → search inside attached PDF/Word/Excel quotes/documents for a specific deal
• get_forecast_calibration → predictive model accuracy, calibration buckets, prediction tracking reports
• query_deals → EVERYTHING ELSE. Any ad-hoc question about the deal data: filtering by industry, date range, deal size, stale deals, lost reasons, counts, averages, recent deals, list of deals, etc.

CRITICAL RULES FOR QUERY_DEALS DATES & TRUNCATION:
1. DATE & MONTH FILTERING RULES:
   - For relative periods ("this month", "last month", "this year", "this fy", "last 7 days", "last 30 days"), pass relativePeriod ('this_month', 'last_month', 'this_year', 'this_fy', 'last_7_days', 'last_30_days').
   - For SPECIFIC named months ("July", "in June", "May 2026", "deals won in July"), pass specificMonth in "YYYY-MM" format (e.g. "2026-07" for July 2026, "2026-06" for June 2026, "2026-05" for May 2026) calculated relative to the injected current date (${currentDate}).
   - FEW-SHOT EXAMPLES (given today is ${currentDate}):
     • "all deals won in July and its value" → query_deals(specificMonth: "2026-07", filters: [{ field: "type", operator: "eq", value: "won" }])
     • "all deals won in August and its value" → query_deals(specificMonth: "2026-08", filters: [{ field: "type", operator: "eq", value: "won" }])
     • "all deals won in June and its value" → query_deals(specificMonth: "2026-06", filters: [{ field: "type", operator: "eq", value: "won" }])
     • "deals won in May 2026" → query_deals(specificMonth: "2026-05", filters: [{ field: "type", operator: "eq", value: "won" }])
   - DO NOT pass freeform date strings in the filters array. Always use relativePeriod or specificMonth.
2. When query_deals returns showingNote or when totalMatched > returned, include an explicit note in your response stating "Showing top N of TOTAL matching deals" so the user is informed about truncation.

CURATED FEW-SHOT Q&A EXAMPLES:

Example 1 (Named Month Table Output):
User: "all deals won in July and its value"
Agent:
Querying \`query_deals(specificMonth: "2026-07", filters: [{ field: "type", operator: "eq", value: "won" }])\`.
### July 2026 Won Deals Summary
**59 won deals** totaling **₹52.75 Lakh** net value.

| Bitrix Deal ID | Customer & Deal Name | Sales Rep | Net Value | Stage | Date |
| :--- | :--- | :--- | :--- | :--- | :--- |
| BITRIX-4464 | Safe Ledger Pvt Ltd / Gurgaon / POE Injector | Taniya Negi | ₹12,600 | Won | 2026-07-31 |
| BITRIX-4410 | Four Points by Sheraton / New Delhi | Jitesh Chander | ₹1,78,100 | Won | 2026-07-28 |

Example 2 (Forecast Calibration & Accuracy):
User: "how accurate are our deal forecasts"
Agent:
Querying \`get_forecast_calibration()\`.
### Deal Forecast Calibration Report
Our predictive forecast engine is **Highly Accurate & Calibrated** across 1,219 historical deals with a mean calibration error of **4%**.
- **80-100% Win Prob Bucket**: 95% predicted vs 92% actual won (Well Calibrated)
- **60-80% Win Prob Bucket**: 72% predicted vs 70% actual won (Well Calibrated)
- **20-40% Win Prob Bucket**: 31% predicted vs 28% actual won (Well Calibrated)

Example 3 (Deal Detail & Analogous Evidence):
User: "tell me about BITRIX-4464 and why win prob is 95%"
Agent:
Querying \`get_deal_detail(query: "BITRIX-4464")\`.
### Deal Detail: BITRIX-4464 (Safe Ledger Pvt Ltd)
- **Assigned Rep**: Taniya Negi
- **Net Value**: **₹12,600**
- **Stage**: Won
- **Blended Win Probability**: **95%** (Base Logistic: 95%, Analogous Deals: 100%)
> [!NOTE]
> **Analogous Past Deals**: Matches 10 comparable closed deals (e.g. BITRIX-3890 Safe Ledger Gurgaon - Won), 10 of which were won.

FORMATTING & RESPONSE STRUCTURE REQUIREMENTS:
1. MANDATORY BITRIX DEAL ID RULE: Every single deal mentioned in ANY table, list, or summary MUST show its Bitrix Deal ID (format: BITRIX-XXXX). NEVER omit the Bitrix Deal ID under any circumstances.
2. STRICT REQUIRED TABLE SCHEMA FOR MULTI-DEAL LISTS:
   Whenever query_deals, get_deals_likely_to_close, or get_sales_projection returns multiple deals, you MUST format the response as a Markdown table using EXACTLY this column order and headers:

   | Bitrix Deal ID | Deal Name & Customer | Sales Rep | Net Value | Stage | Date |
   | :--- | :--- | :--- | :--- | :--- | :--- |
   | BITRIX-4464 | Safe Ledger Pvt Ltd / Gurgaon / POE Injector | Taniya Negi | ₹12,600 | Won | 2026-07-31 |

   CRITICAL TABLE COLUMN REQUIREMENTS:
   - Column 1 MUST be "Bitrix Deal ID" containing the exact ID (e.g. BITRIX-4464).
   - Column 2 MUST be "Deal Name & Customer".
   - Column 3 MUST be "Sales Rep".
   - Column 4 MUST be "Net Value".
   - Column 5 MUST be "Stage".
   - Column 6 MUST be "Date".
   - YOU ARE STRICTLY FORBIDDEN from omitting or changing the "Bitrix Deal ID" column or reordering the columns.
3. CLEAN DEAL TITLES: Never output raw HTML tags (like <br>), stray asterisks (*), or markdown markup inside table cells or deal titles.
4. ALWAYS bold the single headline number in every response (e.g. "**₹42.5 Lakh**", "**18 deals**", "**82%**").
5. Structure narrative answers using section headers (### Section Title), short paragraphs, and blockquotes (> [!NOTE]) instead of long bullet dumps.
6. When answering from an attached document chunk (via search_deal_documents or get_deal_detail's relevantDocumentChunks), ALWAYS cite the source file name.
7. All monetary values are already GST-adjusted (net of 18% GST on won deals) — format in Indian numbering (Lakhs, Crores) for readability.
8. NEVER invent, round differently, or restate numbers differently from what the tool returned.
9. When answering a rep performance question (from get_rep_performance), ALWAYS state the rep's monthly target and their current attainment percentage.`;
}

let globalCheckpointer = null;

function getCheckpointer() {
  if (!globalCheckpointer) {
    globalCheckpointer = new MemorySaver();
  }
  return globalCheckpointer;
}

async function sanitizeSessionHistory(sessionId) {
  if (!sessionId) return;
  const checkpointer = getCheckpointer();
  const config = { configurable: { thread_id: sessionId } };
  try {
    const tuple = await checkpointer.getTuple(config);
    if (!tuple || !tuple.checkpoint || !tuple.checkpoint.channel_values) return;

    const messages = tuple.checkpoint.channel_values.messages;
    if (!Array.isArray(messages) || messages.length === 0) return;

    let cleanIndex = messages.length;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgType = msg._getType ? msg._getType() : msg.type;
      
      if ((msgType === 'ai' || msg.role === 'assistant') && msg.tool_calls && msg.tool_calls.length > 0) {
        const hasToolResponses = messages.slice(i + 1).some(m => (m._getType ? m._getType() : m.type) === 'tool');
        if (!hasToolResponses) {
          cleanIndex = i;
        }
      }
    }

    if (cleanIndex < messages.length) {
      console.log(`[langchainAgent] Pruned ${messages.length - cleanIndex} corrupted/incomplete message(s) from session ${sessionId}`);
      tuple.checkpoint.channel_values.messages = messages.slice(0, cleanIndex);
      await checkpointer.put(config, tuple.checkpoint, tuple.metadata, tuple.versions_seen);
    }
  } catch (err) {
    console.warn(`[langchainAgent] Session history sanitization notice for ${sessionId}:`, err.message);
  }
}

function getApiKey() {
  let apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.length < 5) {
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.resolve(__dirname, '../.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/GEMINI_API_KEY=(.*)/) || content.match(/VITE_GEMINI_API_KEY=(.*)/);
        if (match) apiKey = match[1].trim();
      }
    } catch (_) {}
  }
  return apiKey;
}

function buildConversationalAgent(cache) {
  const rawModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const modelName = rawModel.includes('3.6') ? 'gemini-1.5-flash' : rawModel;
  const apiKey = getApiKey();

  const llm = new ChatGoogleGenerativeAI({
    model: modelName,
    apiKey,
    temperature: 0.3,
    streaming: true,
    maxRetries: 3
  });

  const tools = buildTools(cache);
  const checkpointer = getCheckpointer();

  const agent = createReactAgent({
    llm,
    tools,
    prompt: getSystemPrompt(),
    checkpointer
  });

  return { agent, checkpointer };
}

function clearHistory(sessionId) {
  const checkpointer = getCheckpointer();
  if (checkpointer && checkpointer.storage) {
    for (const key in checkpointer.storage) {
      if (key.includes(sessionId)) {
        delete checkpointer.storage[key];
      }
    }
  }
}

module.exports = { buildConversationalAgent, clearHistory, sanitizeSessionHistory };
