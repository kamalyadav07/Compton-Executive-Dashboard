/**
 * server/services/embeddings/SentenceTransformerProvider.js
 * -----------------------------------------------------------------------
 * Stubbed Local Open-Source SentenceTransformer / ONNX Provider.
 * Model target: all-MiniLM-L6-v2 / BGE-small-en (384 dimensions).
 */

const { EmbeddingProvider } = require('./EmbeddingProvider');

class SentenceTransformerProvider extends EmbeddingProvider {
  constructor(options = {}) {
    super();
    this.modelName = options.modelName || 'Xenova/all-MiniLM-L6-v2';
    this.dimension = 384;
  }

  async embed(_text) {
    throw new Error(
      `[SentenceTransformerProvider] Provider is stubbed. To enable local embeddings:
       1. Install '@xenova/transformers': npm install @xenova/transformers
       2. Initialize pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
       3. Run backfill migration to re-index chunks to 384 dimensions.`
    );
  }

  async embedBatch(_texts) {
    return this.embed('');
  }

  getDimension() {
    return this.dimension;
  }

  getProviderName() {
    return 'sentence-transformers';
  }
}

module.exports = {
  SentenceTransformerProvider
};
