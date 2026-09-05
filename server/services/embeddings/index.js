/**
 * server/services/embeddings/index.js
 * -----------------------------------------------------------------------
 * Embeddings Package Entry Point.
 */

const { EmbeddingProvider } = require('./EmbeddingProvider');
const { GeminiEmbeddingProvider } = require('./GeminiEmbeddingProvider');
const { OpenAIEmbeddingProvider } = require('./OpenAIEmbeddingProvider');
const { SentenceTransformerProvider } = require('./SentenceTransformerProvider');
const { 
  getActiveEmbeddingProvider, 
  searchSemantic, 
  indexChunkEmbedding,
  cosineSimilarity 
} = require('./semanticSearchService');

module.exports = {
  EmbeddingProvider,
  GeminiEmbeddingProvider,
  OpenAIEmbeddingProvider,
  SentenceTransformerProvider,
  getActiveEmbeddingProvider,
  searchSemantic,
  indexChunkEmbedding,
  cosineSimilarity
};
