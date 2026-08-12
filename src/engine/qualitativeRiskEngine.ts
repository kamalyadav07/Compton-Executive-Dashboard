/**
 * src/engine/qualitativeRiskEngine.ts
 * -----------------------------------------------------------------------
 * Qualitative Risk Signal Extractor & Explainable Ensemble Win Probability Adjuster
 *
 * Extracts qualitative risk & urgency signals from deal comments & attachment text:
 *  - competitorMentioned (boolean)
 *  - decisionMakerChanged (boolean)
 *  - customerWentQuiet (boolean: >14 days since last comment timestamp)
 *  - scopeOrPriceChangedRecently (boolean)
 *  - urgencyLanguageDetected (boolean: buyer urgency/deadline extracted)
 *
 * Grounded Ensemble Adjustment:
 *  - Applies explicit, explainable multipliers to nudging logistic regression baseWinProbability.
 *  - Capped between 5% and 95%.
 */

import type { DealRecord } from '../types/sales';

export interface QualitativeRiskSignals {
  competitorMentioned: boolean;
  decisionMakerChanged: boolean;
  customerWentQuiet: boolean;
  quietDays: number;
  scopeOrPriceChangedRecently: boolean;
  urgencyLanguageDetected: boolean;
  extractedUrgencyDate: string | null;
  qualitativeNotes: string;
}

export interface EnsembleActiveSignal {
  key: keyof QualitativeRiskSignals;
  label: string;
  multiplier: number;
  badgeStyle: string;
  description: string;
}

export interface EnsembleScoreResult {
  baseWinProbabilityPct: number;
  adjustedWinProbabilityPct: number;
  adjustmentMultiplier: number;
  activeSignals: EnsembleActiveSignal[];
  extractedSignals: QualitativeRiskSignals;
  explanation: string;
}

// ---------------------------------------------------------------------------
// 1. TIMESTAMPS & QUIET DAYS CALCULATION
// ---------------------------------------------------------------------------

/**
 * Parses latest timestamp from CRM comment text (e.g. "[12.04.2025] ..."),
 * falling back to DATE_MODIFY or DATE_CREATE.
 */
export function computeRealCommentQuietDays(deal: DealRecord): number {
  const comments = deal.comments || deal.remarks || '';
  let latestDate: Date | null = null;

  // Regex for DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD
  const dateRegex = /\b(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{4})\b|\b(\d{4})[\.-](\d{1,2})[\.-](\d{1,2})\b/g;
  let match;

  while ((match = dateRegex.exec(comments)) !== null) {
    let d: Date;
    if (match[1] && match[2] && match[3]) {
      // DD.MM.YYYY format
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      d = new Date(year, month, day);
    } else if (match[4] && match[5] && match[6]) {
      // YYYY-MM-DD format
      d = new Date(parseInt(match[4], 10), parseInt(match[5], 10) - 1, parseInt(match[6], 10));
    } else {
      continue;
    }

    if (!isNaN(d.getTime())) {
      if (!latestDate || d.getTime() > latestDate.getTime()) {
        latestDate = d;
      }
    }
  }

  if (!latestDate) {
    const rawMod = deal.rawRecord?.DATE_MODIFY || deal.rawRecord?.DATE_CREATE || deal.date;
    latestDate = new Date(rawMod);
  }

  if (!latestDate || isNaN(latestDate.getTime())) return 0;

  const now = new Date();
  const diffMs = now.getTime() - latestDate.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// 2. HEURISTIC & LLM QUALITATIVE SIGNAL EXTRACTION
// ---------------------------------------------------------------------------

const COMPETITOR_PATTERNS = [
  'competitor', 'competing', 'dell', 'hp', 'lenovo', 'cisco', 'sophos', 'fortinet',
  'l1', 'l2', 'l3', 'another vendor', 'vendor quote', 'cheaper rate', 'matching price'
];

const DECISION_MAKER_PATTERNS = [
  'decision maker', 'procurement head', 'it head', 'chg', 'changed', 'left organization',
  'resigned', 'new contact', 'new manager', 'transferred', 'new lead'
];

const SCOPE_PRICE_PATTERNS = [
  'revised', 'revision', 'discount', 'price reduction', 'scope change', 'po amount',
  'budget constraint', 'negotiation', 'price drop', 'reduced quantity', 'added items'
];

const URGENCY_PATTERNS = [
  'urgently', 'urgent', 'need by', 'required by', 'deadline', 'po today', 'po tomorrow',
  'asap', 'immediate requirement', 'before month end', 'this week'
];

/**
 * Extracts qualitative risk & urgency signals from comments & document chunks.
 */
export function extractQualitativeRiskSignals(
  deal: DealRecord,
  documentChunks: string[] = []
): QualitativeRiskSignals {
  const commentText = (deal.comments || '') + ' ' + (deal.remarks || '');
  const combinedText = (commentText + ' ' + documentChunks.join(' ')).toLowerCase();

  const quietDays = computeRealCommentQuietDays(deal);
  const customerWentQuiet = deal.type === 'in_progress' && quietDays > 14;

  const competitorMentioned = COMPETITOR_PATTERNS.some(p => combinedText.includes(p));
  const decisionMakerChanged = DECISION_MAKER_PATTERNS.some(p => combinedText.includes(p));
  const scopeOrPriceChangedRecently = SCOPE_PRICE_PATTERNS.some(p => combinedText.includes(p));
  const urgencyLanguageDetected = URGENCY_PATTERNS.some(p => combinedText.includes(p));

  // Extract urgency date if present
  let extractedUrgencyDate: string | null = null;
  const dateMatch = combinedText.match(/(?:need by|required by|deadline|before|by)\s+([0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{2,4}|[a-z]+\s+[0-9]{1,2})/i);
  if (dateMatch) {
    extractedUrgencyDate = dateMatch[1];
  }

  // Notes summary
  const notesParts: string[] = [];
  if (competitorMentioned) notesParts.push('Competitor/third-party vendor discussed in comments.');
  if (customerWentQuiet) notesParts.push(`Customer quiet for ${quietDays} days with no CRM update.`);
  if (decisionMakerChanged) notesParts.push('Mention of contact or decision maker change.');
  if (scopeOrPriceChangedRecently) notesParts.push('Price negotiation or scope revision noted.');
  if (urgencyLanguageDetected) notesParts.push(`Customer indicated urgent timeline${extractedUrgencyDate ? ` (${extractedUrgencyDate})` : ''}.`);

  const qualitativeNotes = notesParts.length > 0 ? notesParts.join(' ') : 'No qualitative risk or urgency flags detected.';

  return {
    competitorMentioned,
    decisionMakerChanged,
    customerWentQuiet,
    quietDays,
    scopeOrPriceChangedRecently,
    urgencyLanguageDetected,
    extractedUrgencyDate,
    qualitativeNotes
  };
}

// ---------------------------------------------------------------------------
// 3. EXPLAINABLE ENSEMBLE WIN-PROBABILITY ADJUSTER
// ---------------------------------------------------------------------------

/**
 * Nudges base logistic regression winProbabilityPct based on qualitative risk signals.
 * Multipliers:
 *  - competitorMentioned: 0.85 (-15%)
 *  - customerWentQuiet: 0.80 (-20%)
 *  - decisionMakerChanged: 0.88 (-12%)
 *  - scopeOrPriceChangedRecently: 0.92 (-8%)
 *  - urgencyLanguageDetected: 1.10 (+10%)
 * Probability is capped between 5% and 95%.
 */
export function ensembleAdjustWinProbability(
  baseProbabilityPct: number,
  signals: QualitativeRiskSignals
): EnsembleScoreResult {
  let multiplier = 1.0;
  const activeSignals: EnsembleActiveSignal[] = [];

  if (signals.competitorMentioned) {
    multiplier *= 0.85;
    activeSignals.push({
      key: 'competitorMentioned',
      label: '⚠ Competitor Mentioned',
      multiplier: 0.85,
      badgeStyle: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      description: 'Competitor / third-party vendor mentioned in deal activity.'
    });
  }

  if (signals.customerWentQuiet) {
    multiplier *= 0.80;
    activeSignals.push({
      key: 'customerWentQuiet',
      label: `🔇 Customer Quiet (${signals.quietDays}d)`,
      multiplier: 0.80,
      badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      description: `No CRM comment logged for ${signals.quietDays} days.`
    });
  }

  if (signals.decisionMakerChanged) {
    multiplier *= 0.88;
    activeSignals.push({
      key: 'decisionMakerChanged',
      label: '🔄 Decision Maker Changed',
      multiplier: 0.88,
      badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      description: 'Key decision maker or contact changed.'
    });
  }

  if (signals.scopeOrPriceChangedRecently) {
    multiplier *= 0.92;
    activeSignals.push({
      key: 'scopeOrPriceChangedRecently',
      label: '📝 Scope/Price Revised',
      multiplier: 0.92,
      badgeStyle: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      description: 'Recent discount request or scope revision.'
    });
  }

  if (signals.urgencyLanguageDetected) {
    multiplier *= 1.10;
    activeSignals.push({
      key: 'urgencyLanguageDetected',
      label: `⚡ Urgent Deadline ${signals.extractedUrgencyDate ? `(${signals.extractedUrgencyDate})` : ''}`,
      multiplier: 1.10,
      badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      description: 'Urgent buyer timeline or PO deadline detected.'
    });
  }

  const rawAdjusted = baseProbabilityPct * multiplier;
  const adjustedWinProbabilityPct = Math.round(Math.max(5, Math.min(95, rawAdjusted)));

  let explanation = `Base win probability of ${baseProbabilityPct}% `;
  if (activeSignals.length === 0) {
    explanation += 'remains unadjusted (no qualitative risk/urgency flags detected).';
  } else {
    const shift = adjustedWinProbabilityPct - baseProbabilityPct;
    explanation += `adjusted to ${adjustedWinProbabilityPct}% (${shift >= 0 ? '+' : ''}${shift}%) based on ${activeSignals.length} qualitative signal(s): ${activeSignals.map(s => s.label).join(', ')}.`;
  }

  return {
    baseWinProbabilityPct: baseProbabilityPct,
    adjustedWinProbabilityPct,
    adjustmentMultiplier: Number(multiplier.toFixed(2)),
    activeSignals,
    extractedSignals: signals,
    explanation
  };
}
