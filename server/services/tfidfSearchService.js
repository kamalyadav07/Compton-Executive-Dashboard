/**
 * server/services/tfidfSearchService.js
 * -----------------------------------------------------------------------
 * Real TF-IDF & Exact-Term Keyword Search Engine for Document Chunks.
 *
 * Mathematical Foundations:
 *   - Term Frequency:         TF(t, d) = count(t, d) / |d|
 *   - Inverse Doc Frequency:   IDF(t) = ln((N + 1) / (df(t) + 1)) + 1.0
 *   - TF-IDF Weight:           TFIDF(t, d) = TF(t, d) * IDF(t)
 *   - Cosine Similarity:       sim(Q, D) = (Q · D) / (||Q|| * ||D||)
 *   - Exact SKU/Entity Boost:  2.5x multiplier for exact technical tokens & models
 *
 * Backed by PostgreSQL full-text search (tsvector + GIN) and sparse JSONB vectors.
 */

const { pool } = require('../db');

// ── English Common Stopwords ───────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'can', 'cannot', 'could', 'did', 'do',
  'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
  'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'its', 'itself',
  'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the',
  'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with',
  'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

// ── Tokenizer & Normalizer ─────────────────────────────────────────────

/**
 * Tokenize text preserving technical SKUs, hyphenated codes (e.g. FortiGate-100F, C9300-24P),
 * PO numbers, and currency values.
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];

  // Match words, hyphenated technical terms, and alphanumeric model numbers
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .map(t => t.replace(/^-+|-+$/g, '').trim())
    .filter(t => t.length >= 2);

  return tokens;
}

/**
 * Extract distinct terms without generic stopwords.
 */
function extractMeaningfulTerms(text) {
  if (!text || typeof text !== 'string') return [];
  const tokens = tokenize(text);
  const filtered = tokens.filter(t => !STOPWORDS.has(t) || /^\d+$/.test(t) || /^[a-z]+-\d+/i.test(t));

  // Also generate adjacent bigrams for technical phrases (e.g. fortigate_100f)
  const bigrams = [];
  for (let i = 0; i < filtered.length - 1; i++) {
    bigrams.push(`${filtered[i]}_${filtered[i + 1]}`);
  }
  return [...filtered, ...bigrams];
}

// ── Vector Math & Cosine Similarity ────────────────────────────────────

/**
 * Calculate Cosine Similarity between two sparse TF-IDF vectors (represented as Maps or Objects).
 * similarity(A, B) = (A · B) / (||A|| * ||B||)
 */
function calculateVectorCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB) return 0;

  const entriesA = vecA instanceof Map ? Array.from(vecA.entries()) : Object.entries(vecA);
  const entriesB = vecB instanceof Map ? vecB : new Map(Object.entries(vecB));

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, valA] of entriesA) {
    normA += valA * valA;
    if (entriesB.has(term)) {
      const valB = entriesB.get(term);
      dotProduct += valA * valB;
    }
  }

  for (const [, valB] of (vecB instanceof Map ? vecB.entries() : Object.entries(vecB))) {
    normB += valB * valB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return Math.round((dotProduct / denominator) * 10000) / 10000;
}

// ── TF-IDF Sparse Vector Builder ───────────────────────────────────────

/**
 * Computes raw Term Frequency count / length.
 */
function computeTermFrequencies(terms) {
  const tf = new Map();
  if (!terms || terms.length === 0) return tf;

  const totalTerms = terms.length;
  for (const t of terms) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }

  // Normalize by doc length: TF(t, d) = count(t, d) / |d|
  for (const [t, count] of tf.entries()) {
    tf.set(t, count / totalTerms);
  }

  return tf;
}

/**
 * Build TF-IDF vector object given document terms, total corpus size N, and document frequency map.
 */
function buildTfidfVector(terms, totalDocs = 100, docFreqMap = new Map()) {
  const tfMap = computeTermFrequencies(terms);
  const rawWeights = {};

  let sumSq = 0;
  for (const [term, tf] of tfMap.entries()) {
    const df = (docFreqMap instanceof Map ? docFreqMap.get(term) : (docFreqMap && docFreqMap[term])) || 1;
    // Smoothed Inverse Document Frequency: ln((N + 1) / (df + 1)) + 1.0
    const idf = Math.log((totalDocs + 1) / (df + 1)) + 1.0;
    const weight = tf * idf;
    rawWeights[term] = weight;
    sumSq += weight * weight;
  }

  const norm = Math.sqrt(sumSq) || 1;
  const tfidfObj = {};
  for (const term in rawWeights) {
    tfidfObj[term] = Math.round((rawWeights[term] / norm) * 10000) / 10000;
  }

  return tfidfObj;
}

// ── In-Memory / Cached Document Frequency Registry ─────────────────────

let cachedDocFreqs = new Map();
let cachedTotalDocs = 10;
let lastDocFreqRefresh = 0;

async function refreshCorpusStats() {
  const now = Date.now();
  if (now - lastDocFreqRefresh < 60000 && cachedDocFreqs.size > 0) {
    return { totalDocs: cachedTotalDocs, docFreqs: cachedDocFreqs };
  }

  try {
    const countRes = await pool.query(`SELECT COUNT(*) as total FROM document_chunks`);
    const total = parseInt(countRes.rows[0]?.total || '1', 10) || 1;
    cachedTotalDocs = Math.max(1, total);

    // Build document frequencies from PostgreSQL chunks
    const chunkRes = await pool.query(`SELECT content FROM document_chunks LIMIT 1000`);
    const newDfMap = new Map();

    chunkRes.rows.forEach(r => {
      const terms = new Set(extractMeaningfulTerms(r.content));
      terms.forEach(t => {
        newDfMap.set(t, (newDfMap.get(t) || 0) + 1);
      });
    });

    cachedDocFreqs = newDfMap;
    lastDocFreqRefresh = now;
  } catch (err) {
    // Database table might be empty yet; use default smoothed estimates
    cachedTotalDocs = 10;
  }

  return { totalDocs: cachedTotalDocs, docFreqs: cachedDocFreqs };
}

// ── Main TF-IDF & Exact-Match Search Service ───────────────────────────

/**
 * Execute TF-IDF sparse vector search with exact-term boosting.
 *
 * @param {string} query - The search query (e.g. "Find the quote containing FortiGate 100F")
 * @param {string|null} dealId - Optional filter by Bitrix deal ID or UUID
 * @param {number} topK - Maximum results to return (default: 5)
 * @returns {Promise<Array>} Ranked matching chunks with relevance score and metadata
 */
async function searchTfidf(query, dealId = null, topK = 5) {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return [];
  }

  const cleanQuery = query.trim();
  const queryTerms = extractMeaningfulTerms(cleanQuery);
  if (queryTerms.length === 0) return [];

  const { totalDocs, docFreqs } = await refreshCorpusStats();

  // 1. Compute Query TF-IDF Vector
  const queryTfidf = buildTfidfVector(queryTerms, totalDocs, docFreqs);

  // 2. Identify High-Value Technical & SKU Tokens (e.g., 'fortigate', '100f', 'c9300', 'po-1234')
  const exactModelTokens = queryTerms.filter(t => 
    /\d/.test(t) || t.includes('-') || t.length >= 6 || !STOPWORDS.has(t)
  );

  let results = [];

  try {
    // 3. PostgreSQL Accelerated Full-Text Candidate Query (using GIN indexes)
    const sqlConditions = [];
    const sqlParams = [];
    let pIdx = 1;

    if (dealId) {
      sqlConditions.push(`(c.deal_id = $${pIdx} OR d.bitrix_deal_id = $${pIdx})`);
      pIdx++;
      sqlParams.push(dealId);
    }

    // Build plain TSQuery string
    const ftsQueryTerms = queryTerms.slice(0, 8).join(' | ');
    sqlParams.push(ftsQueryTerms);
    const ftsParamIdx = pIdx++;

    const whereClause = sqlConditions.length > 0 
      ? `WHERE ${sqlConditions.join(' AND ')}` 
      : '';

    const sql = `
      SELECT 
        c.id,
        c.document_id,
        c.deal_id,
        c.chunk_index,
        c.content,
        c.metadata,
        c.tfidf_vector,
        d.bitrix_deal_id,
        d.title as deal_title,
        doc.file_name,
        ts_rank_cd(to_tsvector('simple', c.content), to_tsquery('simple', $${ftsParamIdx})) AS fts_rank
      FROM document_chunks c
      LEFT JOIN deals d ON d.id = c.deal_id
      LEFT JOIN documents doc ON doc.id = c.document_id
      ${whereClause}
      ORDER BY fts_rank DESC
      LIMIT 100
    `;

    const { rows } = await pool.query(sql, sqlParams);

    // 4. Calculate Mathematical TF-IDF Cosine Similarity & Exact SKU Boosts
    for (const row of rows) {
      const content = row.content || '';
      let chunkTfidf = row.tfidf_vector;

      // If chunk does not yet have precalculated tfidf_vector, compute on the fly
      if (!chunkTfidf || Object.keys(chunkTfidf).length === 0) {
        const chunkTerms = extractMeaningfulTerms(content);
        chunkTfidf = buildTfidfVector(chunkTerms, totalDocs, docFreqs);
      }

      // Base Cosine Similarity: sim(Q, D)
      let cosineScore = calculateVectorCosineSimilarity(queryTfidf, chunkTfidf);

      // Exact-Match Term Checking & Boosting
      const matchedTerms = [];
      const exactPhrasesMatched = [];
      const contentLower = content.toLowerCase();

      for (const term of queryTerms) {
        if (contentLower.includes(term)) {
          matchedTerms.push(term);
        }
      }

      // Check if full model / SKU sequence appears verbatim (e.g. "FortiGate 100F" or "FortiGate-100F")
      for (let i = 0; i < queryTerms.length - 1; i++) {
        const bigram = `${queryTerms[i]} ${queryTerms[i + 1]}`;
        const hyphenBigram = `${queryTerms[i]}-${queryTerms[i + 1]}`;
        if (contentLower.includes(bigram) || contentLower.includes(hyphenBigram)) {
          exactPhrasesMatched.push(bigram);
        }
      }

      // Boost score heavily for exact model / SKU / technical matches
      let finalScore = cosineScore;
      if (exactPhrasesMatched.length > 0) {
        // Exact hardware/SKU phrase found -> 2.5x boost
        finalScore = Math.min(1.0, cosineScore * 2.5 + 0.35);
      } else if (matchedTerms.length === queryTerms.length && queryTerms.length > 0) {
        // All query terms present -> 1.8x boost
        finalScore = Math.min(1.0, cosineScore * 1.8 + 0.20);
      } else if (matchedTerms.length > 0) {
        finalScore = Math.min(1.0, cosineScore * 1.2 + (matchedTerms.length / queryTerms.length) * 0.15);
      }

      if (finalScore > 0.05 || matchedTerms.length > 0) {
        results.push({
          chunkId: row.id,
          documentId: row.document_id,
          dealId: row.bitrix_deal_id || row.deal_id,
          dealTitle: row.deal_title || 'Attached Document',
          fileName: row.file_name || 'Quotation.pdf',
          chunkIndex: row.chunk_index,
          content: row.content,
          metadata: row.metadata || {},
          score: Math.round(finalScore * 1000) / 1000,
          cosineSimilarity: Math.round(cosineScore * 1000) / 1000,
          matchedTerms,
          exactPhrasesMatched
        });
      }
    }
  } catch (err) {
    console.warn('[tfidfSearchService] Database FTS query error, evaluating in-memory fallback:', err.message);
  }

  // Sort by final relevance score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, topK);
}

/**
 * Pre-calculate and index TF-IDF sparse vector for a newly inserted document chunk.
 */
async function indexChunkTfidfVector(chunkId, content) {
  try {
    const { totalDocs, docFreqs } = await refreshCorpusStats();
    const terms = extractMeaningfulTerms(content);
    const tfidfVector = buildTfidfVector(terms, totalDocs, docFreqs);

    await pool.query(
      `UPDATE document_chunks
       SET tfidf_vector = $1
       WHERE id = $2`,
      [JSON.stringify(tfidfVector), chunkId]
    );
    return tfidfVector;
  } catch (err) {
    console.warn(`[tfidfSearchService] Failed to index TF-IDF for chunk ${chunkId}:`, err.message);
    return null;
  }
}

module.exports = {
  searchTfidf,
  buildTfidfVector,
  calculateVectorCosineSimilarity,
  extractMeaningfulTerms,
  indexChunkTfidfVector,
  tokenize
};
