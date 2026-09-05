/**
 * server/services/hybridRetrievalService.js
 * -----------------------------------------------------------------------
 * Hybrid Document Retrieval Engine combining TF-IDF Exact Keyword Search
 * (Phase 6) and Dense Semantic Vector Search (Phase 7).
 *
 * Scoring Formula:
 *   finalScore = (TFIDF_WEIGHT * normTfidf) + (SEMANTIC_WEIGHT * normSemantic)
 *
 * NOTE ON WEIGHTS:
 *   TFIDF_WEIGHT (0.40) and SEMANTIC_WEIGHT (0.60) are empirical starting values.
 *   These will be tuned and calibrated in Phase 22 against the evaluation benchmark dataset.
 */

const { searchTfidf } = require('./tfidfSearchService');
const { searchSemantic } = require('./embeddings/semanticSearchService');

// ── Baseline Weight Constants ───────────────────────────────────────────

const DEFAULT_TFIDF_WEIGHT = 0.40;
const DEFAULT_SEMANTIC_WEIGHT = 0.60;
const DEFAULT_CANDIDATE_LIMIT = 20;
const DEFAULT_TOP_K = 8;

// ── Score Normalization Helper ──────────────────────────────────────────

function normalizeScores(results) {
  if (!results || results.length === 0) return new Map();

  const scores = results.map(r => r.score || 0);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreMap = new Map();

  results.forEach(r => {
    let norm = r.score || 0;
    if (maxScore > minScore) {
      norm = (norm - minScore) / (maxScore - minScore);
    } else if (maxScore > 0) {
      norm = Math.min(1.0, norm);
    }
    scoreMap.set(r.chunkId, {
      normalizedScore: Math.round(norm * 10000) / 10000,
      rawScore: r.score,
      item: r
    });
  });

  return scoreMap;
}

// ── Hybrid Retrieval Core Function ─────────────────────────────────────

/**
 * Executes concurrent TF-IDF and Semantic search, merges candidate pools,
 * computes normalized hybrid scores, and returns top evidence chunks.
 *
 * @param {string} query - User natural language query or technical SKU search
 * @param {Object} options - { dealId, topK, candidateLimit, tfidfWeight, semanticWeight }
 * @returns {Promise<Object>} Object containing ranked evidenceChunks and retrieval telemetry
 */
async function retrieveHybridEvidence(query, options = {}) {
  const startTime = Date.now();

  const dealId = options.dealId || null;
  const topK = options.topK || DEFAULT_TOP_K;
  const candidateLimit = options.candidateLimit || DEFAULT_CANDIDATE_LIMIT;
  const tfidfWeight = options.tfidfWeight !== undefined ? options.tfidfWeight : DEFAULT_TFIDF_WEIGHT;
  const semanticWeight = options.semanticWeight !== undefined ? options.semanticWeight : DEFAULT_SEMANTIC_WEIGHT;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return {
      query: '',
      dealId,
      evidenceChunks: [],
      totalCandidatesEvaluated: 0,
      executionTimeMs: 0
    };
  }

  // 1. Run TF-IDF and Semantic Vector Search concurrently
  const [tfidfCandidates, semanticCandidates] = await Promise.all([
    searchTfidf(query, dealId, candidateLimit).catch(err => {
      console.warn('[hybridRetrieval] TF-IDF search failed:', err.message);
      return [];
    }),
    searchSemantic(query, dealId, candidateLimit).catch(err => {
      console.warn('[hybridRetrieval] Semantic search failed:', err.message);
      return [];
    })
  ]);

  // 2. Normalize both candidate score sets to [0, 1]
  const tfidfMap = normalizeScores(tfidfCandidates);
  const semanticMap = normalizeScores(semanticCandidates);

  // 3. Union candidate pools by chunk ID
  const allChunkIds = new Set([...tfidfMap.keys(), ...semanticMap.keys()]);
  const mergedResults = [];

  for (const chunkId of allChunkIds) {
    const tfidfEntry = tfidfMap.get(chunkId);
    const semanticEntry = semanticMap.get(chunkId);

    const baseItem = tfidfEntry?.item || semanticEntry?.item;
    if (!baseItem) continue;

    const normTfidf = tfidfEntry ? tfidfEntry.normalizedScore : 0;
    const normSemantic = semanticEntry ? semanticEntry.normalizedScore : 0;

    // Combined Weighted Score
    let finalScore = (tfidfWeight * normTfidf) + (semanticWeight * normSemantic);

    // Exact SKU / Verbatim Keyword Boost
    const exactMatches = tfidfEntry?.item?.exactPhrasesMatched || [];
    if (exactMatches.length > 0) {
      finalScore = Math.min(1.0, finalScore * 1.25 + 0.15);
    }

    let retrievalMethod = 'hybrid';
    if (tfidfEntry && !semanticEntry) retrievalMethod = 'tfidf_only';
    else if (!tfidfEntry && semanticEntry) retrievalMethod = 'semantic_only';

    mergedResults.push({
      chunkId: baseItem.chunkId,
      documentId: baseItem.documentId,
      dealId: baseItem.dealId,
      dealTitle: baseItem.dealTitle,
      fileName: baseItem.fileName,
      chunkIndex: baseItem.chunkIndex,
      content: baseItem.content,
      metadata: baseItem.metadata || {},
      finalScore: Math.round(finalScore * 1000) / 1000,
      tfidfScore: tfidfEntry ? Math.round(tfidfEntry.rawScore * 1000) / 1000 : 0,
      semanticScore: semanticEntry ? Math.round(semanticEntry.rawScore * 1000) / 1000 : 0,
      retrievalMethod,
      matchedTerms: tfidfEntry?.item?.matchedTerms || [],
      exactPhrasesMatched: exactMatches
    });
  }

  // 4. In-Process Fast Reranking: Sort by finalScore descending
  mergedResults.sort((a, b) => b.finalScore - a.finalScore);

  const topEvidenceChunks = mergedResults.slice(0, topK);
  const executionTimeMs = Date.now() - startTime;

  return {
    query,
    dealId,
    evidenceChunks: topEvidenceChunks,
    totalCandidatesEvaluated: mergedResults.length,
    weightsUsed: {
      tfidf: tfidfWeight,
      semantic: semanticWeight
    },
    executionTimeMs
  };
}

module.exports = {
  retrieveHybridEvidence,
  DEFAULT_TFIDF_WEIGHT,
  DEFAULT_SEMANTIC_WEIGHT
};
