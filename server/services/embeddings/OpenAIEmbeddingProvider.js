/**
 * server/services/embeddings/OpenAIEmbeddingProvider.js
 * -----------------------------------------------------------------------
 * Stubbed OpenAI Embedding Provider (for future vendor swapping).
 * Model target: text-embedding-3-small (1536 dimensions) or text-embedding-3-large (3072 dimensions).
 */

const { EmbeddingProvider } = require('./EmbeddingProvider');

class OpenAIEmbeddingProvider extends EmbeddingProvider {
  constructor(options = {}) {
    super();
    this.modelName = options.modelName || 'text-embedding-3-small';
    this.dimension = 1536;
  }

  async embed(_text) {
    throw new Error(
      `[OpenAIEmbeddingProvider] Provider is stubbed. To enable OpenAI embeddings:
       1. Install 'openai' package: npm install openai
       2. Set OPENAI_API_KEY in server/.env
       3. Run backfill migration to re-index chunks to 1536 dimensions.`
    );
  }

  async embedBatch(_texts) {
    return this.embed('');
  }

  getDimension() {
    return this.dimension;
  }

  getProviderName() {
    return 'openai';
  }
}

module.exports = {
  OpenAIEmbeddingProvider
};
