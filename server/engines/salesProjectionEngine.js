var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../src/engine/salesProjectionEngine.ts
var salesProjectionEngine_exports = {};
__export(salesProjectionEngine_exports, {
  cleanDealTitle: () => cleanDealTitle,
  computePipelineValue: () => computePipelineValue,
  computeRevenueToDate: () => computeRevenueToDate,
  computeSalesProjection: () => computeSalesProjection,
  computeWeightedForecast: () => computeWeightedForecast,
  dealLabel: () => dealLabel,
  formatDealLabel: () => formatDealLabel,
  getFYBounds: () => getFYBounds,
  getMonthBounds: () => getMonthBounds
});
module.exports = __toCommonJS(salesProjectionEngine_exports);

// ../src/utils/financeUtils.ts
var GST_RATE = 0.18;
function splitGst(grossRevenue, isWon) {
  const gross = Number.isFinite(grossRevenue) ? grossRevenue : 0;
  if (!isWon) {
    return { netRevenue: gross, gstAmount: 0 };
  }
  const netRevenue = Math.round(gross / (1 + GST_RATE) * 100) / 100;
  const gstAmount = Math.round((gross - netRevenue) * 100) / 100;
  return { netRevenue, gstAmount };
}

// ../src/utils/textUtils.ts
function cleanDealTitle(rawTitle) {
  if (!rawTitle) return "";
  let cleaned = String(rawTitle);
  cleaned = cleaned.replace(/<[^>]+>/g, " ");
  cleaned = cleaned.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  cleaned = cleaned.replace(/[*_`~]/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}
function formatDealLabel(title, dealId) {
  const clean = cleanDealTitle(title);
  if (!clean) return dealId ? `Deal (${dealId})` : "Untitled Deal";
  if (dealId && !clean.toLowerCase().includes(dealId.toLowerCase())) {
    return `${clean} (${dealId})`;
  }
  return clean;
}

// ../src/engine/qualitativeRiskEngine.ts
function computeRealCommentQuietDays(deal) {
  const comments = deal.comments || deal.remarks || "";
  let latestDate = null;
  const dateRegex = /\b(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{4})\b|\b(\d{4})[\.-](\d{1,2})[\.-](\d{1,2})\b/g;
  let match;
  while ((match = dateRegex.exec(comments)) !== null) {
    let d;
    if (match[1] && match[2] && match[3]) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      d = new Date(year, month, day);
    } else if (match[4] && match[5] && match[6]) {
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
  const now = /* @__PURE__ */ new Date();
  const diffMs = now.getTime() - latestDate.getTime();
  return Math.max(0, Math.floor(diffMs / (1e3 * 60 * 60 * 24)));
}
var COMPETITOR_PATTERNS = [
  "competitor",
  "competing",
  "dell",
  "hp",
  "lenovo",
  "cisco",
  "sophos",
  "fortinet",
  "l1",
  "l2",
  "l3",
  "another vendor",
  "vendor quote",
  "cheaper rate",
  "matching price"
];
var DECISION_MAKER_PATTERNS = [
  "decision maker",
  "procurement head",
  "it head",
  "chg",
  "changed",
  "left organization",
  "resigned",
  "new contact",
  "new manager",
  "transferred",
  "new lead"
];
var SCOPE_PRICE_PATTERNS = [
  "revised",
  "revision",
  "discount",
  "price reduction",
  "scope change",
  "po amount",
  "budget constraint",
  "negotiation",
  "price drop",
  "reduced quantity",
  "added items"
];
var URGENCY_PATTERNS = [
  "urgently",
  "urgent",
  "need by",
  "required by",
  "deadline",
  "po today",
  "po tomorrow",
  "asap",
  "immediate requirement",
  "before month end",
  "this week"
];
function extractQualitativeRiskSignals(deal, documentChunks = []) {
  const commentText = (deal.comments || "") + " " + (deal.remarks || "");
  const combinedText = (commentText + " " + documentChunks.join(" ")).toLowerCase();
  const quietDays = computeRealCommentQuietDays(deal);
  const customerWentQuiet = deal.type === "in_progress" && quietDays > 14;
  const competitorMentioned = COMPETITOR_PATTERNS.some((p) => combinedText.includes(p));
  const decisionMakerChanged = DECISION_MAKER_PATTERNS.some((p) => combinedText.includes(p));
  const scopeOrPriceChangedRecently = SCOPE_PRICE_PATTERNS.some((p) => combinedText.includes(p));
  const urgencyLanguageDetected = URGENCY_PATTERNS.some((p) => combinedText.includes(p));
  let extractedUrgencyDate = null;
  const dateMatch = combinedText.match(/(?:need by|required by|deadline|before|by)\s+([0-9]{1,2}[\/\.-][0-9]{1,2}[\/\.-][0-9]{2,4}|[a-z]+\s+[0-9]{1,2})/i);
  if (dateMatch) {
    extractedUrgencyDate = dateMatch[1];
  }
  const notesParts = [];
  if (competitorMentioned) notesParts.push("Competitor/third-party vendor discussed in comments.");
  if (customerWentQuiet) notesParts.push(`Customer quiet for ${quietDays} days with no CRM update.`);
  if (decisionMakerChanged) notesParts.push("Mention of contact or decision maker change.");
  if (scopeOrPriceChangedRecently) notesParts.push("Price negotiation or scope revision noted.");
  if (urgencyLanguageDetected) notesParts.push(`Customer indicated urgent timeline${extractedUrgencyDate ? ` (${extractedUrgencyDate})` : ""}.`);
  const qualitativeNotes = notesParts.length > 0 ? notesParts.join(" ") : "No qualitative risk or urgency flags detected.";
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
function ensembleAdjustWinProbability(baseProbabilityPct, signals) {
  let multiplier = 1;
  const activeSignals = [];
  if (signals.competitorMentioned) {
    multiplier *= 0.85;
    activeSignals.push({
      key: "competitorMentioned",
      label: "\u26A0 Competitor Mentioned",
      multiplier: 0.85,
      badgeStyle: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      description: "Competitor / third-party vendor mentioned in deal activity."
    });
  }
  if (signals.customerWentQuiet) {
    multiplier *= 0.8;
    activeSignals.push({
      key: "customerWentQuiet",
      label: `\u{1F507} Customer Quiet (${signals.quietDays}d)`,
      multiplier: 0.8,
      badgeStyle: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      description: `No CRM comment logged for ${signals.quietDays} days.`
    });
  }
  if (signals.decisionMakerChanged) {
    multiplier *= 0.88;
    activeSignals.push({
      key: "decisionMakerChanged",
      label: "\u{1F504} Decision Maker Changed",
      multiplier: 0.88,
      badgeStyle: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      description: "Key decision maker or contact changed."
    });
  }
  if (signals.scopeOrPriceChangedRecently) {
    multiplier *= 0.92;
    activeSignals.push({
      key: "scopeOrPriceChangedRecently",
      label: "\u{1F4DD} Scope/Price Revised",
      multiplier: 0.92,
      badgeStyle: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      description: "Recent discount request or scope revision."
    });
  }
  if (signals.urgencyLanguageDetected) {
    multiplier *= 1.1;
    activeSignals.push({
      key: "urgencyLanguageDetected",
      label: `\u26A1 Urgent Deadline ${signals.extractedUrgencyDate ? `(${signals.extractedUrgencyDate})` : ""}`,
      multiplier: 1.1,
      badgeStyle: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      description: "Urgent buyer timeline or PO deadline detected."
    });
  }
  const rawAdjusted = baseProbabilityPct * multiplier;
  const adjustedWinProbabilityPct = Math.round(Math.max(5, Math.min(95, rawAdjusted)));
  let explanation = `Base win probability of ${baseProbabilityPct}% `;
  if (activeSignals.length === 0) {
    explanation += "remains unadjusted (no qualitative risk/urgency flags detected).";
  } else {
    const shift = adjustedWinProbabilityPct - baseProbabilityPct;
    explanation += `adjusted to ${adjustedWinProbabilityPct}% (${shift >= 0 ? "+" : ""}${shift}%) based on ${activeSignals.length} qualitative signal(s): ${activeSignals.map((s) => s.label).join(", ")}.`;
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

// ../src/engine/dealIntelligenceEngine.ts
var STAGE_ORDER = [
  "need analysis",
  "solution design",
  "solution approval",
  "quote creation",
  "quote approval",
  "negotiation"
];
function stageProgress(stage) {
  const idx = STAGE_ORDER.indexOf((stage || "").toLowerCase());
  if (idx === -1) return 0.3;
  return (idx + 1) / STAGE_ORDER.length;
}
function daysBetween(a, b) {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (isNaN(t1) || isNaN(t2)) return 0;
  return Math.max(0, Math.round((t2 - t1) / (1e3 * 60 * 60 * 24)));
}
function computeRealAgeDays(deal) {
  const created = deal.rawRecord?.DATE_CREATE || deal.date;
  return daysBetween(created, /* @__PURE__ */ new Date());
}
function computeRealDaysSinceUpdate(deal) {
  const modified = deal.rawRecord?.DATE_MODIFY || deal.rawRecord?.DATE_CREATE || deal.date;
  return daysBetween(modified, /* @__PURE__ */ new Date());
}
function buildFeatures(deal, benchmarks) {
  const repKey = deal.salesRep.trim().toLowerCase();
  const indKey = deal.industry.trim().toLowerCase();
  const srcKey = (deal.leadSource || "").trim().toLowerCase();
  const repAvgSize = benchmarks.repAvgWonSize[repKey] || 35e4;
  return {
    repWinRate: benchmarks.repWinRates[repKey] ?? 0.5,
    industryWinRate: benchmarks.industryWinRates[indKey] ?? 0.5,
    sourceWinRate: benchmarks.sourceWinRates[srcKey] ?? 0.5,
    sizeRatio: Math.min(3, deal.grossRevenue / repAvgSize),
    ageDays: computeRealAgeDays(deal),
    stageProgress: stageProgress(deal.stage),
    hasComments: deal.comments && deal.comments.trim().length > 0 ? 1 : 0
  };
}
var FEATURE_KEYS = [
  "repWinRate",
  "industryWinRate",
  "sourceWinRate",
  "sizeRatio",
  "ageDays",
  "stageProgress",
  "hasComments"
];
function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}
function toVector(f) {
  return FEATURE_KEYS.map((k) => f[k]);
}
function standardize(vectors) {
  const n = vectors.length;
  const dims = vectors[0].length;
  const means = new Array(dims).fill(0);
  const stds = new Array(dims).fill(1);
  for (let d = 0; d < dims; d++) {
    means[d] = vectors.reduce((s, v) => s + v[d], 0) / n;
  }
  for (let d = 0; d < dims; d++) {
    const variance = vectors.reduce((s, v) => s + (v[d] - means[d]) ** 2, 0) / n;
    stds[d] = Math.sqrt(variance) || 1;
  }
  const normed = vectors.map((v) => v.map((val, d) => (val - means[d]) / stds[d]));
  return { normed, means, stds };
}
function trainWinProbabilityModel(closedDeals, benchmarks, opts = {}) {
  const epochs = opts.epochs ?? 500;
  const lr = opts.learningRate ?? 0.3;
  const l2 = opts.l2 ?? 0.01;
  const labeled = closedDeals.filter((d) => d.type === "won" || d.type === "lost").map((d) => ({ x: toVector(buildFeatures(d, benchmarks)), y: d.type === "won" ? 1 : 0 }));
  if (labeled.length < 20) {
    return {
      weights: new Array(FEATURE_KEYS.length).fill(0),
      bias: 0,
      featureMeans: new Array(FEATURE_KEYS.length).fill(0),
      featureStds: new Array(FEATURE_KEYS.length).fill(1),
      trainedOn: labeled.length,
      trainedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const { normed, means, stds } = standardize(labeled.map((l) => l.x));
  const dims = normed[0].length;
  let weights = new Array(dims).fill(0);
  let bias = 0;
  const n = normed.length;
  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(dims).fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      const z = normed[i].reduce((s, v, d) => s + v * weights[d], bias);
      const pred = sigmoid(z);
      const err = pred - labeled[i].y;
      for (let d = 0; d < dims; d++) gradW[d] += err * normed[i][d];
      gradB += err;
    }
    for (let d = 0; d < dims; d++) {
      weights[d] -= lr * (gradW[d] / n + l2 * weights[d]);
    }
    bias -= lr * (gradB / n);
  }
  return { weights, bias, featureMeans: means, featureStds: stds, trainedOn: n, trainedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function scoreDeal(deal, model, benchmarks) {
  const raw = toVector(buildFeatures(deal, benchmarks));
  const normed = raw.map((v, d) => (v - model.featureMeans[d]) / model.featureStds[d]);
  const z = normed.reduce((s, v, d) => s + v * model.weights[d], model.bias);
  const prob = sigmoid(z);
  return Math.round(Math.max(1, Math.min(99, prob * 100)));
}
function buildCycleLengthDistribution(wonDeals) {
  const byStage = {};
  wonDeals.forEach((d) => {
    const key = (d.stage || "unknown").toLowerCase();
    if (!byStage[key]) byStage[key] = [];
    if (d.salesCycleDays && d.salesCycleDays > 0) byStage[key].push(d.salesCycleDays);
  });
  byStage["__all__"] = wonDeals.map((d) => d.salesCycleDays || 30).filter((v) => v > 0);
  return byStage;
}
function probabilityCloseWithinDays(deal, distribution, horizonDays) {
  const stageKey = (deal.stage || "unknown").toLowerCase();
  let sample = distribution[stageKey];
  if (!sample || sample.length < 8) sample = distribution["__all__"] || [];
  const ageDays = computeRealAgeDays(deal);
  const stillAlive = sample.filter((c) => c >= ageDays);
  const sampleSize = stillAlive.length;
  let probabilityPct;
  if (sampleSize < 5) {
    probabilityPct = 35;
  } else {
    const closesInWindow = stillAlive.filter((c) => c <= ageDays + horizonDays).length;
    probabilityPct = Math.round(closesInWindow / sampleSize * 100);
  }
  const medianRemaining = sampleSize > 0 ? median(stillAlive.map((c) => Math.max(0, c - ageDays))) : 14;
  const expectedClose = /* @__PURE__ */ new Date();
  expectedClose.setDate(expectedClose.getDate() + medianRemaining);
  return {
    probabilityPct,
    sampleSize,
    expectedCloseDate: expectedClose.toISOString().slice(0, 10)
  };
}
function median(arr) {
  if (arr.length === 0) return 14;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
function buildBenchmarks(allDeals) {
  const won = allDeals.filter((d) => d.type === "won");
  const lost = allDeals.filter((d) => d.type === "lost");
  const rate = (key) => {
    const wonCount = {};
    const lostCount = {};
    won.forEach((d) => {
      const k = key(d).trim().toLowerCase();
      wonCount[k] = (wonCount[k] || 0) + 1;
    });
    lost.forEach((d) => {
      const k = key(d).trim().toLowerCase();
      lostCount[k] = (lostCount[k] || 0) + 1;
    });
    const out = {};
    (/* @__PURE__ */ new Set([...Object.keys(wonCount), ...Object.keys(lostCount)])).forEach((k) => {
      const w = wonCount[k] || 0, l = lostCount[k] || 0;
      out[k] = w + l > 0 ? w / (w + l) : 0.5;
    });
    return out;
  };
  const repAvgWonSize = {};
  const byRep = {};
  won.forEach((d) => {
    const k = d.salesRep.trim().toLowerCase();
    (byRep[k] ||= []).push(d);
  });
  Object.entries(byRep).forEach(([k, deals]) => {
    repAvgWonSize[k] = deals.reduce((s, d) => s + d.grossRevenue, 0) / deals.length;
  });
  return {
    repWinRates: rate((d) => d.salesRep),
    industryWinRates: rate((d) => d.industry),
    sourceWinRates: rate((d) => d.leadSource),
    repAvgWonSize
  };
}
function runDealIntelligence(allDeals, documentChunksMap = {}) {
  const benchmarks = buildBenchmarks(allDeals);
  const closedDeals = allDeals.filter((d) => d.type === "won" || d.type === "lost");
  const model = trainWinProbabilityModel(closedDeals, benchmarks);
  const distribution = buildCycleLengthDistribution(allDeals.filter((d) => d.type === "won"));
  const openDeals = allDeals.filter((d) => d.type === "in_progress");
  const results = openDeals.map((deal) => {
    const baseWinProbabilityPct = scoreDeal(deal, model, benchmarks);
    const docChunks = documentChunksMap[deal.id] || [];
    const qualitativeSignals = extractQualitativeRiskSignals(deal, docChunks);
    const ensembleScore = ensembleAdjustWinProbability(baseWinProbabilityPct, qualitativeSignals);
    const p7 = probabilityCloseWithinDays(deal, distribution, 7);
    const p15 = probabilityCloseWithinDays(deal, distribution, 15);
    return {
      deal,
      winProbabilityPct: ensembleScore.adjustedWinProbabilityPct,
      baseWinProbabilityPct,
      qualitativeSignals,
      ensembleScore,
      closesWithin7DaysPct: p7.probabilityPct,
      closesWithin15DaysPct: p15.probabilityPct,
      expectedCloseDate: p15.expectedCloseDate,
      ageDays: computeRealAgeDays(deal),
      daysSinceLastUpdate: computeRealDaysSinceUpdate(deal),
      confidenceNote: p15.sampleSize < 5 ? `Low historical sample (${p15.sampleSize} comparable won deals) \u2014 treat as directional, not exact.` : `Based on ${p15.sampleSize} comparable historical won deals.`
    };
  });
  return { results, model, distribution };
}

// ../src/engine/salesProjectionEngine.ts
function dealLabel(deal) {
  const rawTitle = deal.rawRecord?.TITLE || `${deal.customer}`;
  return formatDealLabel(rawTitle, deal.id);
}
function getFYBounds(asOf = /* @__PURE__ */ new Date()) {
  const year = asOf.getMonth() >= 3 ? asOf.getFullYear() : asOf.getFullYear() - 1;
  return {
    start: new Date(year, 3, 1),
    end: new Date(year + 1, 2, 31, 23, 59, 59),
    label: `FY${year}-${String(year + 1).slice(2)}`
  };
}
function getMonthBounds(asOf = /* @__PURE__ */ new Date()) {
  const start = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  const end = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0, 23, 59, 59);
  return { start, end, label: start.toLocaleString("en-IN", { month: "long", year: "numeric" }) };
}
function computeRevenueToDate(deals, period) {
  return deals.filter((d) => d.type === "won").filter((d) => {
    const closeDate = new Date(d.rawRecord?.CLOSEDATE || d.rawRecord?.DATE_MODIFY || d.date);
    return closeDate >= period.start && closeDate <= period.end;
  }).reduce((sum, d) => sum + splitGst(d.grossRevenue, true).netRevenue, 0);
}
function computePipelineValue(deals) {
  return deals.filter((d) => d.type === "in_progress").reduce((sum, d) => sum + splitGst(d.grossRevenue, true).netRevenue, 0);
}
function computeWeightedForecast(intelligence, period, asOf = /* @__PURE__ */ new Date(), distribution) {
  const daysToHorizon = Math.max(0, Math.round((period.end.getTime() - asOf.getTime()) / (1e3 * 60 * 60 * 24)));
  let expectedValue = 0;
  const highConfidenceDeals = [];
  intelligence.forEach((r) => {
    let closeWithinHorizonPct;
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
function computeSalesProjection(allDeals, scope, targets, asOf = /* @__PURE__ */ new Date()) {
  const period = scope === "month" ? getMonthBounds(asOf) : getFYBounds(asOf);
  const target = scope === "month" ? targets.monthlyTarget : targets.yearlyTarget;
  const revenueToDate = computeRevenueToDate(allDeals, period);
  const pipelineValue = computePipelineValue(allDeals);
  const { results: intelligence, distribution } = runDealIntelligence(allDeals);
  const { expectedValue, highConfidenceDeals } = computeWeightedForecast(intelligence, period, asOf, distribution);
  const totalProjection = revenueToDate + expectedValue;
  const gapToTarget = target - totalProjection;
  const projectedAttainmentPct = target > 0 ? Math.round(totalProjection / target * 100) : 0;
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
    topDealsLikelyToClose: highConfidenceDeals.sort((a, b) => b.winProbabilityPct - a.winProbabilityPct).slice(0, 8).map((r) => ({
      dealId: r.deal.id,
      dealName: dealLabel(r.deal),
      company: r.deal.customer,
      salesRep: r.deal.salesRep || "Unassigned",
      netValue: splitGst(r.deal.grossRevenue, true).netRevenue,
      winProbabilityPct: r.winProbabilityPct,
      closesWithin7DaysPct: r.closesWithin7DaysPct,
      closesWithin15DaysPct: r.closesWithin15DaysPct,
      expectedCloseDate: r.expectedCloseDate
    })),
    dealCounts: {
      won: allDeals.filter((d) => d.type === "won").length,
      open: allDeals.filter((d) => d.type === "in_progress").length,
      lost: allDeals.filter((d) => d.type === "lost").length
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cleanDealTitle,
  computePipelineValue,
  computeRevenueToDate,
  computeSalesProjection,
  computeWeightedForecast,
  dealLabel,
  formatDealLabel,
  getFYBounds,
  getMonthBounds
});
