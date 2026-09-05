/**
 * server/services/nlpFeatureService.js
 * -----------------------------------------------------------------------
 * Dual-Tier NLP Qualitative Feature Extraction Service.
 *
 * Tier 1 (Fast-Path): Synchronous regex/keyword pattern extractor (<1ms)
 * Tier 2 (Deep Semantic): Structured Gemini LLM extraction for granular CRM signals
 *
 * Persists versioned NLP features into PostgreSQL `features` table.
 */

const { pool } = require('../db');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const path = require('path');
const fs = require('fs');

// ── In-Memory Cache for LLM Results (1 Hour TTL) ────────────────────────
const nlpCache = new Map();
const NLP_CACHE_TTL_MS = 60 * 60 * 1000;

function getCachedNlp(key) {
  const item = nlpCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    nlpCache.delete(key);
    return null;
  }
  return item.data;
}

function setCachedNlp(key, data) {
  nlpCache.set(key, { data, expiresAt: Date.now() + NLP_CACHE_TTL_MS });
}

// ── API Key Helper ──────────────────────────────────────────────────────

function getGeminiApiKey() {
  let key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    const paths = [
      path.resolve(__dirname, '../../../.env'),
      path.resolve(__dirname, '../../.env')
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const match = content.match(/^GEMINI_API_KEY=(.*)$/m) || content.match(/^VITE_GEMINI_API_KEY=(.*)$/m);
        if (match && match[1].trim()) {
          key = match[1].trim().replace(/^['"]|['"]$/g, '');
          break;
        }
      }
    }
  }
  return key || '';
}

// ── Tier 1: Synchronous Fast-Path Keyword Extractor ────────────────────

const COMPETITOR_PATTERNS = [
  'competitor', 'competing', 'dell', 'hp', 'lenovo', 'cisco', 'sophos', 'fortinet',
  'aruba', 'juniper', 'hikvision', 'dahua', 'l1', 'l2', 'l3', 'another vendor',
  'vendor quote', 'cheaper rate', 'matching price'
];

const DECISION_MAKER_PATTERNS = [
  'cfo', 'ceo', 'cto', 'cio', 'it head', 'procurement head', 'decision maker',
  'director', 'management approval', 'committee', 'changed', 'left organization',
  'resigned', 'new contact', 'new manager', 'transferred', 'new lead'
];

const PRICE_OBJECTION_PATTERNS = [
  'price is higher', 'high price', 'expensive', 'costly', 'budget issue',
  'cheaper than', 'higher than', 'discount', 'price reduction', 'tight budget',
  'rate issue', 'budget constraint', 'price negotiation', 'reduce price'
];

const PROCUREMENT_PATTERNS = [
  'procurement', 'approval', 'waiting for approval', 'cfo approval', 'po process',
  'vendor onboarding', 'vendor registration', 'commercial terms', 'tender', 'rfp'
];

const URGENCY_PATTERNS = [
  'urgently', 'urgent', 'need by', 'required by', 'deadline', 'po today', 'po tomorrow',
  'asap', 'immediate requirement', 'before month end', 'this week'
];

/**
 * Fast synchronous pattern matching for instantaneous UI rendering.
 */
function extractFastKeywordSignals(text) {
  if (!text || typeof text !== 'string') {
    return {
      competitor_mentioned: null,
      price_objection: false,
      budget_issue: false,
      decision_maker: null,
      decision_maker_change: false,
      procurement: false,
      technical_blocker: null,
      urgency: 'none',
      positive_sentiment: false,
      negative_sentiment: false,
      customer_commitment: false,
      expected_po_date: null,
      source: 'keyword_fast_path'
    };
  }

  const lower = text.toLowerCase();

  // Detect Competitor
  let competitor = null;
  for (const comp of ['dell', 'hp', 'lenovo', 'cisco', 'sophos', 'fortinet', 'aruba', 'juniper', 'hikvision', 'dahua']) {
    if (lower.includes(comp)) {
      competitor = comp.charAt(0).toUpperCase() + comp.slice(1);
      break;
    }
  }
  if (!competitor && COMPETITOR_PATTERNS.some(p => lower.includes(p))) {
    competitor = 'Competitor Mentioned';
  }

  // Detect Decision Maker
  let decisionMaker = null;
  if (lower.includes('cfo')) decisionMaker = 'CFO';
  else if (lower.includes('ceo')) decisionMaker = 'CEO';
  else if (lower.includes('cto')) decisionMaker = 'CTO';
  else if (lower.includes('it head')) decisionMaker = 'IT Head';
  else if (lower.includes('procurement head')) decisionMaker = 'Procurement Head';

  const decisionMakerChange = Boolean(decisionMaker) || DECISION_MAKER_PATTERNS.some(p => lower.includes(p));
  const priceObjection = PRICE_OBJECTION_PATTERNS.some(p => lower.includes(p));
  const budgetIssue = lower.includes('budget') || lower.includes('tight budget');
  const procurement = PROCUREMENT_PATTERNS.some(p => lower.includes(p));
  const urgency = URGENCY_PATTERNS.some(p => lower.includes(p)) ? 'high' : 'none';

  return {
    competitor_mentioned: competitor,
    price_objection: priceObjection,
    budget_issue: budgetIssue,
    decision_maker: decisionMaker,
    decision_maker_change: decisionMakerChange,
    procurement: procurement,
    technical_blocker: null,
    urgency,
    positive_sentiment: lower.includes('positive') || lower.includes('confirmed') || lower.includes('accepted'),
    negative_sentiment: priceObjection || lower.includes('delay') || lower.includes('risk'),
    customer_commitment: lower.includes('po confirmed') || lower.includes('agreed') || lower.includes('order finalized'),
    expected_po_date: null,
    source: 'keyword_fast_path'
  };
}

// ── Tier 2: Deep Semantic LLM Feature Extraction (Gemini Structured Output) ──

/**
 * Deep semantic LLM feature extraction using Gemini GenAI.
 *
 * @param {string} text - Deal remarks, CRM comments, activity transcript
 * @param {string|null} dealId - Optional Bitrix deal ID / UUID
 * @returns {Promise<Object>}
 */
async function extractLlmNlpFeatures(text, dealId = null) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return extractFastKeywordSignals('');
  }

  const cleanText = text.trim();
  const cacheKey = `nlp:${cleanText.slice(0, 200)}`;
  const cached = getCachedNlp(cacheKey);
  if (cached) return cached;

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    // Graceful fallback to Tier 1 fast-path if API key is not configured
    return extractFastKeywordSignals(cleanText);
  }

  try {
    const rawModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const modelName = rawModel.includes('3.6') ? 'gemini-1.5-flash' : rawModel;
    const llm = new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey,
      temperature: 0.0,
      maxRetries: 2
    });

    const systemPrompt = `You are a precision CRM NLP signal extraction engine for enterprise B2B deals.
Analyze the following deal notes/comments and extract qualitative signals into exact JSON.

JSON Schema:
{
  "competitor_mentioned": "string or null (e.g. 'Dell', 'Cisco', 'HP', null)",
  "price_objection": "boolean (true if customer complained about pricing, requested discount, or said competitor is cheaper)",
  "budget_issue": "boolean (true if customer budget is constrained or unallocated)",
  "decision_maker": "string or null (e.g. 'CFO', 'IT Head', 'Director', null)",
  "decision_maker_change": "boolean (true if decision maker changed, left, or approval is waiting on higher stakeholder)",
  "procurement": "boolean (true if deal is in procurement, RFP, tender, or PO approval process)",
  "technical_blocker": "string or null (e.g. 'PoC failed', 'Incompatible specs', null)",
  "urgency": "'high' | 'medium' | 'low' | 'none'",
  "positive_sentiment": "boolean",
  "negative_sentiment": "boolean",
  "customer_commitment": "boolean (true if customer agreed to buy or promised PO)",
  "expected_po_date": "string or null (e.g. '2026-08-30' or null)"
}

Respond ONLY with valid JSON and NO markdown code fences.`;

    const response = await llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Deal Text: "${cleanText}"` }
    ]);

    const content = (response?.content || '{}').trim().replace(/```json|```/gi, '').trim();
    const parsed = JSON.parse(content);

    const result = {
      competitor_mentioned: parsed.competitor_mentioned || null,
      price_objection: Boolean(parsed.price_objection),
      budget_issue: Boolean(parsed.budget_issue),
      decision_maker: parsed.decision_maker || null,
      decision_maker_change: Boolean(parsed.decision_maker_change || parsed.decision_maker),
      procurement: Boolean(parsed.procurement),
      technical_blocker: parsed.technical_blocker || null,
      urgency: ['high', 'medium', 'low', 'none'].includes(parsed.urgency) ? parsed.urgency : 'none',
      positive_sentiment: Boolean(parsed.positive_sentiment),
      negative_sentiment: Boolean(parsed.negative_sentiment),
      customer_commitment: Boolean(parsed.customer_commitment),
      expected_po_date: parsed.expected_po_date || null,
      source: 'llm_structured_gemini',
      version: 'nlp-v1'
    };

    setCachedNlp(cacheKey, result);

    // Asynchronously save features to PostgreSQL features table if dealId is provided
    if (dealId) {
      persistNlpFeatures(dealId, result).catch(() => {});
    }

    return result;
  } catch (err) {
    console.warn('[nlpFeatureService] LLM extraction failed, using fast-path keyword fallback:', err.message);
    return extractFastKeywordSignals(cleanText);
  }
}

/**
 * Persist versioned NLP features into PostgreSQL `features` table.
 */
async function persistNlpFeatures(dealId, nlpFeatures) {
  try {
    const keys = [
      { key: 'nlp_v1:price_objection', val: nlpFeatures.price_objection ? 1 : 0 },
      { key: 'nlp_v1:budget_issue', val: nlpFeatures.budget_issue ? 1 : 0 },
      { key: 'nlp_v1:competitor_mentioned', val: nlpFeatures.competitor_mentioned ? 1 : 0 },
      { key: 'nlp_v1:procurement', val: nlpFeatures.procurement ? 1 : 0 },
      { key: 'nlp_v1:decision_maker_change', val: nlpFeatures.decision_maker_change ? 1 : 0 },
      { key: 'nlp_v1:urgency_high', val: nlpFeatures.urgency === 'high' ? 1 : 0 }
    ];

    for (const item of keys) {
      await pool.query(
        `INSERT INTO features (deal_id, feature_key, feature_value, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (deal_id, feature_key) DO UPDATE SET
           feature_value = EXCLUDED.feature_value,
           created_at = CURRENT_TIMESTAMP`,
        [dealId, item.key, item.val]
      );
    }
  } catch (err) {
    console.warn(`[nlpFeatureService] Database save notice for deal ${dealId}:`, err.message);
  }
}

module.exports = {
  extractFastKeywordSignals,
  extractLlmNlpFeatures,
  persistNlpFeatures
};
