/**
 * server/scripts/backfill-embeddings.js
 * -----------------------------------------------------------------------
 * Re-embeds document chunks in PostgreSQL using the active EmbeddingProvider
 * and computes TF-IDF sparse vectors.
 *
 * Usage:
 *   node server/scripts/backfill-embeddings.js
 */

const { pool } = require('../db');
const { getActiveEmbeddingProvider } = require('../services/embeddings');
const { indexChunkTfidfVector } = require('../services/tfidfSearchService');

async function backfillEmbeddings() {
  console.log('🚀 Starting Document Chunks Embedding Backfill...');
  const provider = getActiveEmbeddingProvider();
  console.log(`🔌 Active Embedding Provider: [${provider.getProviderName()}] (${provider.getDimension()} dimensions)`);

  try {
    const { rows: chunks } = await pool.query(
      `SELECT id, content, embedding, tfidf_vector
       FROM document_chunks
       ORDER BY created_at ASC`
    );

    console.log(`📁 Found ${chunks.length} total document chunk(s) in PostgreSQL.`);
    if (chunks.length === 0) {
      console.log('✨ No chunks to backfill.');
      return;
    }

    let embeddedCount = 0;
    let tfidfCount = 0;

    for (const chunk of chunks) {
      // 1. Check if Dense Vector Embedding is missing
      if (!chunk.embedding) {
        try {
          const vector = await provider.embed(chunk.content);
          const vectorStr = `[${vector.join(',')}]`;
          await pool.query(
            `UPDATE document_chunks SET embedding = $1::vector WHERE id = $2`,
            [vectorStr, chunk.id]
          );
          embeddedCount++;
        } catch (embErr) {
          console.warn(`  ⚠️ Failed embedding chunk ${chunk.id}:`, embErr.message);
        }
      }

      // 2. Check if Sparse TF-IDF Vector is missing
      if (!chunk.tfidf_vector || Object.keys(chunk.tfidf_vector).length === 0) {
        await indexChunkTfidfVector(chunk.id, chunk.content);
        tfidfCount++;
      }
    }

    console.log(`🎉 Backfill Complete: Indexed ${embeddedCount} dense embeddings, ${tfidfCount} TF-IDF sparse vectors.`);
  } catch (err) {
    console.error('💥 Backfill error:', err.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  backfillEmbeddings();
}

module.exports = { backfillEmbeddings };
