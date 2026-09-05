/**
 * server/services/embeddings/semanticSearchService.js
 * -----------------------------------------------------------------------
 * Semantic Vector Search Engine using PostgreSQL pgvector & HNSW Cosine Index.
 * Powered by active EmbeddingProvider (default: Gemini text-embedding-004 / 768 dims).
 */

const { pool } = require('../../db');
const { GeminiEmbeddingProvider } = require('./GeminiEmbeddingProvider');
const { OpenAIEmbeddingProvider } = require('./OpenAIEmbeddingProvider');
const { SentenceTransformerProvider } = require('./SentenceTransformerProvider');

// ── Provider Factory ───────────────────────────────────────────────────

let activeProviderInstance = null;

function getActiveEmbeddingProvider() {
  if (!activeProviderInstance) {
    const providerName = (process.env.EMBEDDING_PROVIDER || 'gemini').toLowerCase().trim();
    switch (providerName) {
      case 'openai':
        activeProviderInstance = new OpenAIEmbeddingProvider();
        break;
      case 'sentence-transformers':
      case 'local':
        activeProviderInstance = new SentenceTransformerProvider();
        break;
      case 'gemini':
      default:
        activeProviderInstance = new GeminiEmbeddingProvider();
        break;
    }
  }
  return activeProviderInstance;
}

// ── In-Memory Cosine Similarity Fallback ────────────────────────────────

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Semantic Search Function ───────────────────────────────────────────

/**
 * Perform semantic similarity search using dense vector embeddings in PostgreSQL.
 *
 * @param {string} query - Natural language query
 * @param {string|null} dealId - Optional filter by deal UUID or Bitrix deal ID
 * @param {number} topK - Maximum results (default: 5)
 * @returns {Promise<Array>}
 */
async function searchSemantic(query, dealId = null, topK = 5) {
  if (!query || typeof query !== 'string' || query.trim() === '') return [];

  const provider = getActiveEmbeddingProvider();
  const queryVector = await provider.embed(query);
  const vectorStr = `[${queryVector.join(',')}]`;

  try {
    const sqlParams = [vectorStr];
    let whereClause = 'WHERE c.embedding IS NOT NULL';

    if (dealId) {
      sqlParams.push(dealId);
      whereClause += ` AND (c.deal_id = $2 OR d.bitrix_deal_id = $2)`;
    }

    sqlParams.push(topK);
    const limitParamIdx = sqlParams.length;

    // PostgreSQL pgvector Cosine Distance Query with HNSW Index
    const sql = `
      SELECT 
        c.id,
        c.document_id,
        c.deal_id,
        c.chunk_index,
        c.content,
        c.metadata,
        d.bitrix_deal_id,
        d.title as deal_title,
        doc.file_name,
        ROUND((1 - (c.embedding <=> $1::vector))::numeric, 4) AS similarity
      FROM document_chunks c
      LEFT JOIN deals d ON d.id = c.deal_id
      LEFT JOIN documents doc ON doc.id = c.document_id
      ${whereClause}
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $${limitParamIdx}
    `;

    const { rows } = await pool.query(sql, sqlParams);

    return rows.map(r => ({
      chunkId: r.id,
      documentId: r.document_id,
      dealId: r.bitrix_deal_id || r.deal_id,
      dealTitle: r.deal_title || 'Attached Document',
      fileName: r.file_name || 'Quotation.pdf',
      chunkIndex: r.chunk_index,
      content: r.content,
      metadata: r.metadata || {},
      score: parseFloat(r.similarity || '0'),
      provider: provider.getProviderName()
    }));
  } catch (err) {
    console.warn('[semanticSearchService] Database pgvector query fallback:', err.message);
    return [];
  }
}

/**
 * Index dense embedding vector for a newly parsed chunk in PostgreSQL.
 */
async function indexChunkEmbedding(chunkId, content) {
  try {
    const provider = getActiveEmbeddingProvider();
    const vector = await provider.embed(content);
    const vectorStr = `[${vector.join(',')}]`;

    await pool.query(
      `UPDATE document_chunks
       SET embedding = $1::vector
       WHERE id = $2`,
      [vectorStr, chunkId]
    );
    return vector;
  } catch (err) {
    console.warn(`[semanticSearchService] Failed to index embedding for chunk ${chunkId}:`, err.message);
    return null;
  }
}

module.exports = {
  getActiveEmbeddingProvider,
  searchSemantic,
  indexChunkEmbedding,
  cosineSimilarity
};
