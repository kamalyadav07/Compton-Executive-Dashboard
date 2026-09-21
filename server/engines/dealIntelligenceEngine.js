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

// src/engine/dealIntelligenceEngine.ts
var dealIntelligenceEngine_exports = {};
__export(dealIntelligenceEngine_exports, {
  blendEnsembleWinProbability: () => blendEnsembleWinProbability,
  buildBenchmarks: () => buildBenchmarks,
  buildCycleLengthDistribution: () => buildCycleLengthDistribution,
  buildDealTextProfile: () => buildDealTextProfile,
  buildFeatures: () => buildFeatures,
  computeDealVectorEmbedding: () => computeDealVectorEmbedding,
  computeRealAgeDays: () => computeRealAgeDays,
  computeRealDaysSinceUpdate: () => computeRealDaysSinceUpdate,
  cosineSimilarityVectors: () => cosineSimilarityVectors,
  findAnalogousDeals: () => findAnalogousDeals,
  getDealSizeBucket: () => getDealSizeBucket,
  probabilityCloseWithinDays: () => probabilityCloseWithinDays,
  runDealIntelligence: () => runDealIntelligence,
  scoreDeal: () => scoreDeal,
  trainWinProbabilityModel: () => trainWinProbabilityModel
});
module.exports = __toCommonJS(dealIntelligenceEngine_exports);

var envWebhookUrl = (process.env.VITE_BITRIX_WEBHOOK_URL || process.env.BITRIX_WEBHOOK_URL || "").trim();
var DEFAULT_BITRIX_CONFIG = {
  webhookBaseUrl: envWebhookUrl ? envWebhookUrl.endsWith("/") ? envWebhookUrl : `${envWebhookUrl}/` : "",
  dealsWebhookUrl: envWebhookUrl ? `${envWebhookUrl.replace(/\/+$/, "")}/crm.deal.list.json?SELECT%5B%5D=*&SELECT%5B%5D=UF_*` : "",
  leadsWebhookUrl: envWebhookUrl ? `${envWebhookUrl.replace(/\/+$/, "")}/crm.lead.list.json?SELECT%5B%5D=*&SELECT%5B%5D=UF_*` : "",
  autoSync: true,
  minDate: "2019-01-01"
};

// src/engine/bitrixFetchQueue.ts
var RateLimitedQueue = class {
  concurrency;
  minIntervalMs;
  maxRetries;
  active = 0;
  lastStart = 0;
  queue = [];
  constructor(opts = {}) {
    this.concurrency = opts.concurrency ?? 4;
    this.minIntervalMs = opts.minIntervalMs ?? 550;
    this.maxRetries = opts.maxRetries ?? 4;
  }
  /** Schedule a fetch. Resolves with the parsed JSON, or throws after retries are exhausted. */
  async run(taskFn, label = "request") {
    await this.acquireSlot();
    try {
      return await this.withRetry(taskFn, label);
    } finally {
      this.releaseSlot();
    }
  }
  acquireSlot() {
    return new Promise((resolve) => {
      const tryStart = () => {
        const now = Date.now();
        const waitForRate = Math.max(0, this.minIntervalMs - (now - this.lastStart));
        if (this.active < this.concurrency && waitForRate === 0) {
          this.active++;
          this.lastStart = Date.now();
          resolve();
        } else {
          setTimeout(tryStart, Math.max(20, waitForRate));
        }
      };
      this.queue.push(tryStart);
      if (this.queue.length === 1 || this.active < this.concurrency) tryStart();
    });
  }
  releaseSlot() {
    this.active = Math.max(0, this.active - 1);
    this.queue.shift();
    if (this.queue.length > 0) this.queue[0]();
  }
  async withRetry(taskFn, label) {
    let lastErr;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await taskFn();
        if (result && typeof result === "object" && "error" in result) {
          const errCode = result.error;
          if (errCode === "QUERY_LIMIT_EXCEEDED" || errCode === "OPERATION_TIME_LIMIT") {
            throw new Error(`Bitrix throttled: ${errCode}`);
          }
        }
        return result;
      } catch (err) {
        lastErr = err;
        const backoff = Math.min(8e3, 400 * Math.pow(2, attempt)) + Math.random() * 250;
        console.warn(`[bitrixFetchQueue] ${label} failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${Math.round(backoff)}ms`, err);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    throw new Error(`[bitrixFetchQueue] ${label} permanently failed after ${this.maxRetries + 1} attempts: ${String(lastErr)}`);
  }
};

// src/engine/bitrixService.ts
var bitrixQueue = new RateLimitedQueue({ concurrency: 3, minIntervalMs: 300, maxRetries: 4 });
var BITRIX_CLOSURE_PROBABILITY_MAP = {
  "384": { value: 0, label: "Very Low - 0 %" },
  "386": { value: 25, label: "Low - 25 %" },
  "388": { value: 50, label: "Medium - 50 %" },
  "390": { value: 75, label: "High - 75 %" },
  "392": { value: 100, label: "Very High - 100 %" }
};
function parseBitrixClosureProbability(val) {
  if (val === void 0 || val === null || val === "" || val === false) {
    return { value: null, label: null };
  }
  const str = String(val).trim();
  if (BITRIX_CLOSURE_PROBABILITY_MAP[str]) {
    return BITRIX_CLOSURE_PROBABILITY_MAP[str];
  }
  const lower = str.toLowerCase();
  if (lower.includes("not selected") || lower === "none" || lower === "null") {
    return { value: null, label: null };
  }
  if (lower.includes("very high") || lower.includes("100")) {
    return { value: 100, label: "Very High - 100 %" };
  }
  if (lower.includes("high") || lower.includes("75")) {
    return { value: 75, label: "High - 75 %" };
  }
  if (lower.includes("medium") || lower.includes("50")) {
    return { value: 50, label: "Medium - 50 %" };
  }
  if (lower.includes("very low") || lower.includes("0 %") || lower === "0") {
    return { value: 0, label: "Very Low - 0 %" };
  }
  if (lower.includes("low") || lower.includes("25")) {
    return { value: 25, label: "Low - 25 %" };
  }
  const num = parseFloat(str);
  if (!isNaN(num) && num >= 0 && num <= 100) {
    return { value: num, label: `${num}%` };
  }
  return { value: null, label: null };
}

// src/engine/qualitativeRiskEngine.ts
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
  const created = deal.rawRecord?.DATE_CREATE || deal.date;
  const dealAgeDays = created ? Math.max(0, Math.round((Date.now() - new Date(created).getTime()) / 864e5)) : 0;
  const dealStalled = deal.type === "in_progress" && dealAgeDays > 60 && quietDays >= 14;
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
  if (dealStalled) notesParts.push(`Deal stalled: age ${dealAgeDays}d with no activity for ${quietDays}d.`);
  else if (customerWentQuiet) notesParts.push(`Customer quiet for ${quietDays} days with no CRM update.`);
  if (decisionMakerChanged) notesParts.push("Mention of contact or decision maker change.");
  if (scopeOrPriceChangedRecently) notesParts.push("Price negotiation or scope revision noted.");
  if (urgencyLanguageDetected) notesParts.push(`Customer indicated urgent timeline${extractedUrgencyDate ? ` (${extractedUrgencyDate})` : ""}.`);
  const qualitativeNotes = notesParts.length > 0 ? notesParts.join(" ") : "No qualitative risk or urgency flags detected.";
  return {
    competitorMentioned,
    decisionMakerChanged,
    customerWentQuiet,
    dealStalled,
    quietDays,
    dealAgeDays,
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
  if (signals.dealStalled) {
    const stallMult = signals.dealAgeDays > 180 ? 0.6 : 0.75;
    multiplier *= stallMult;
    activeSignals.push({
      key: "dealStalled",
      label: signals.dealAgeDays > 180 ? `\u{1F6D1} Dormant (${signals.dealAgeDays}d)` : `\u23F3 Stalled (${signals.dealAgeDays}d)`,
      multiplier: stallMult,
      badgeStyle: signals.dealAgeDays > 180 ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-amber-500/20 text-amber-300 border-amber-500/40",
      description: `Deal is ${signals.dealAgeDays} days old with no CRM activity for ${signals.quietDays} days.`
    });
  } else if (signals.customerWentQuiet) {
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

// src/engine/dealIntelligenceEngine.ts
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
    const variance = vectors.reduce((s2, v) => s2 + (v[d] - means[d]) ** 2, 0) / n;
    const s = Math.sqrt(variance);
    stds[d] = isNaN(s) || s < 1e-4 ? 1 : s;
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
  const quietDays = computeRealDaysSinceUpdate(deal);
  const stillAlive = sample.filter((c) => c >= ageDays);
  const sampleSize = stillAlive.length;
  let probabilityPct;
  if (ageDays > 180) {
    probabilityPct = 2;
  } else if (ageDays > 90) {
    probabilityPct = 5;
  } else if (ageDays > 60) {
    probabilityPct = 10;
  } else if (sampleSize < 5) {
    probabilityPct = 25;
  } else {
    const closesInWindow = stillAlive.filter((c) => c <= ageDays + horizonDays).length;
    probabilityPct = Math.round(closesInWindow / sampleSize * 100);
  }
  if (quietDays >= 21) {
    probabilityPct = Math.round(probabilityPct * 0.1);
  } else if (quietDays >= 14) {
    probabilityPct = Math.round(probabilityPct * 0.25);
  }
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const rawCloseDate = deal.rawRecord?.CLOSEDATE ? deal.rawRecord.CLOSEDATE.slice(0, 10) : null;
  const isFuturePlanned = rawCloseDate && new Date(rawCloseDate) >= today;
  let expectedCloseStr;
  if (isFuturePlanned && rawCloseDate) {
    expectedCloseStr = rawCloseDate;
  } else {
    const expectedClose = /* @__PURE__ */ new Date();
    if (ageDays > 60 || quietDays >= 14) {
      const pushOutDays = Math.max(30, Math.min(90, Math.round(ageDays * 0.2) + quietDays));
      expectedClose.setDate(expectedClose.getDate() + pushOutDays);
    } else {
      const medianRemaining = sampleSize >= 5 ? median(stillAlive.map((c) => Math.max(0, c - ageDays))) : 14;
      expectedClose.setDate(expectedClose.getDate() + Math.max(3, medianRemaining));
    }
    expectedCloseStr = expectedClose.toISOString().slice(0, 10);
  }
  return {
    probabilityPct,
    sampleSize,
    expectedCloseDate: expectedCloseStr
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
function getDealSizeBucket(amount) {
  if (amount < 1e5) return "<\u20B91 Lakh";
  if (amount < 5e5) return "\u20B91L - \u20B95 Lakhs";
  if (amount < 2e6) return "\u20B95L - \u20B920 Lakhs";
  if (amount < 5e6) return "\u20B920L - \u20B950 Lakhs";
  return ">\u20B950 Lakhs";
}
function buildDealTextProfile(deal, docSummary) {
  const customer = deal.customer || "";
  const title = deal.rawRecord?.TITLE || customer;
  const industry = deal.industry || "General Industry";
  const solution = deal.solution || "Enterprise Solution";
  const leadSource = deal.leadSource || "Direct";
  const rep = deal.salesRep || "";
  const stage = deal.stage || "";
  const sizeBucket = getDealSizeBucket(deal.grossRevenue || deal.netRevenue || 0);
  const comments = (deal.comments || deal.remarks || "").trim();
  const docInfo = docSummary ? ` Document Context: ${docSummary}` : "";
  return `Deal: ${title} | Customer: ${customer} | Industry: ${industry} | Solution: ${solution} | Size: ${sizeBucket} | Rep: ${rep} | Source: ${leadSource} | Stage: ${stage} | Comments: ${comments}${docInfo}`.trim();
}
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}
var dealEmbeddingCache = /* @__PURE__ */ new Map();
function computeDealVectorEmbedding(deal, docSummary) {
  const textProfile = buildDealTextProfile(deal, docSummary);
  const profileHash = hashString(textProfile);
  const cacheKey = deal.id || profileHash;
  const cached = dealEmbeddingCache.get(cacheKey);
  if (cached && cached.profileHash === profileHash) {
    return cached.vector;
  }
  const dims = 128;
  const vector = new Array(dims).fill(0);
  const tokens = textProfile.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) % dims;
    vector[Math.abs(h)] += 1;
  }
  const normText = textProfile.toLowerCase();
  for (let i = 0; i < normText.length - 2; i++) {
    const gram = normText.slice(i, i + 3);
    let h = 0;
    for (let j = 0; j < gram.length; j++) h = (h * 37 + gram.charCodeAt(j)) % dims;
    vector[Math.abs(h)] += 0.5;
  }
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += vector[i] * vector[i];
  const magnitude = Math.sqrt(norm) || 1;
  const normalizedVector = vector.map((v) => v / magnitude);
  dealEmbeddingCache.set(cacheKey, { profileHash, vector: normalizedVector });
  return normalizedVector;
}
function cosineSimilarityVectors(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return Math.max(0, Math.min(1, dot));
}
function findAnalogousDeals(targetDeal, closedDeals, topK = 10, docSummary) {
  const targetVec = computeDealVectorEmbedding(targetDeal, docSummary);
  const matches = closedDeals.map((closed) => {
    const closedVec = computeDealVectorEmbedding(closed);
    const sim = cosineSimilarityVectors(targetVec, closedVec);
    const sizeMatch = getDealSizeBucket(targetDeal.grossRevenue) === getDealSizeBucket(closed.grossRevenue);
    const indMatch = (targetDeal.industry || "").toLowerCase() === (closed.industry || "").toLowerCase();
    const solMatch = (targetDeal.solution || "").toLowerCase() === (closed.solution || "").toLowerCase();
    const reasonParts = [];
    if (indMatch) reasonParts.push(`Same Industry (${targetDeal.industry})`);
    if (solMatch) reasonParts.push(`Same Solution (${targetDeal.solution})`);
    if (sizeMatch) reasonParts.push(`Similar Deal Size (${getDealSizeBucket(targetDeal.grossRevenue)})`);
    if (reasonParts.length === 0) reasonParts.push(`Comparable pipeline attributes`);
    return {
      dealId: closed.id.startsWith("BITRIX-") ? closed.id : `BITRIX-${closed.id}`,
      customer: closed.customer,
      dealTitle: closed.rawRecord?.TITLE || `${closed.customer} (${closed.solution})`,
      solution: closed.solution,
      industry: closed.industry,
      outcome: closed.type === "won" ? "won" : "lost",
      netRevenue: closed.netRevenue,
      grossRevenue: closed.grossRevenue,
      similarityScore: Math.round(sim * 100) / 100,
      reason: reasonParts.join(", ")
    };
  });
  matches.sort((a, b) => b.similarityScore - a.similarityScore);
  const topMatches = matches.slice(0, topK);
  const wonCount = topMatches.filter((m) => m.outcome === "won").length;
  const analogousWinRate = topMatches.length > 0 ? Math.round(wonCount / topMatches.length * 100) : 50;
  return {
    analogousWinRate,
    analogousDeals: topMatches
  };
}
var LOGISTIC_WEIGHT = 0.6;
var ANALOGOUS_WEIGHT = 0.25;
var QUALITATIVE_WEIGHT = 0.15;
function blendEnsembleWinProbability(baseWinProbabilityPct, analogousWinRate, ensembleScore, repClosureProbability) {
  const qualWinProb = Math.max(5, Math.min(95, ensembleScore.adjustedWinProbabilityPct));
  if (repClosureProbability !== null && repClosureProbability !== void 0 && !isNaN(repClosureProbability)) {
    const repProb = Math.max(0, Math.min(100, repClosureProbability));
    const blended2 = 0.4 * repProb + 0.35 * baseWinProbabilityPct + 0.15 * analogousWinRate + 0.1 * qualWinProb;
    return Math.round(Math.max(5, Math.min(98, blended2)));
  }
  const blended = LOGISTIC_WEIGHT * baseWinProbabilityPct + ANALOGOUS_WEIGHT * analogousWinRate + QUALITATIVE_WEIGHT * qualWinProb;
  return Math.round(Math.max(5, Math.min(95, blended)));
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
    const docSummary = docChunks.length > 0 ? docChunks.join(" ") : void 0;
    const qualitativeSignals = extractQualitativeRiskSignals(deal, docChunks);
    const ensembleScore = ensembleAdjustWinProbability(baseWinProbabilityPct, qualitativeSignals);
    const { analogousWinRate, analogousDeals } = findAnalogousDeals(deal, closedDeals, 10, docSummary);
    const probInfo = deal.closureProbability !== void 0 && deal.closureProbability !== null ? { value: deal.closureProbability, label: deal.closureProbabilityLabel || `${deal.closureProbability}%` } : parseBitrixClosureProbability(deal.rawRecord?.UF_CRM_1745298149375);
    const finalWinProbPct = blendEnsembleWinProbability(
      baseWinProbabilityPct,
      analogousWinRate,
      ensembleScore,
      probInfo.value
    );
    const p7 = probabilityCloseWithinDays(deal, distribution, 7);
    const p15 = probabilityCloseWithinDays(deal, distribution, 15);
    return {
      deal,
      winProbabilityPct: finalWinProbPct,
      baseWinProbabilityPct,
      analogousWinRate,
      analogousDeals,
      qualitativeSignals,
      ensembleScore,
      repClosureProbability: probInfo.value,
      repClosureProbabilityLabel: probInfo.label,
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  blendEnsembleWinProbability,
  buildBenchmarks,
  buildCycleLengthDistribution,
  buildDealTextProfile,
  buildFeatures,
  computeDealVectorEmbedding,
  computeRealAgeDays,
  computeRealDaysSinceUpdate,
  cosineSimilarityVectors,
  findAnalogousDeals,
  getDealSizeBucket,
  probabilityCloseWithinDays,
  runDealIntelligence,
  scoreDeal,
  trainWinProbabilityModel
});
