/**
 * server/services/embeddings/GeminiEmbeddingProvider.js
 * -----------------------------------------------------------------------
 * Production Google Gemini Embedding Provider.
 * Generates 768-dimensional dense vector embeddings using Google GenAI SDK.
 */

const { EmbeddingProvider } = require('./EmbeddingProvider');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const path = require('path');
const fs = require('fs');

class GeminiEmbeddingProvider extends EmbeddingProvider {
  constructor(options = {}) {
    super();
    this.modelName = options.modelName || process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
    this.dimension = 768;
    this._client = null;
  }

  _getApiKey() {
    let key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
      const paths = [
        path.resolve(__dirname, '../../../.env'),
        path.resolve(__dirname, '../../.env')
      ];
      for (const p of paths) {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf8');
          const match = content.match(/^GEMINI_API_KEY=(.*)$/m);
          if (match && match[1].trim()) {
            key = match[1].trim().replace(/^['"]|['"]$/g, '');
            break;
          }
        }
      }
    }
    return key || '';
  }

  _getClient() {
    if (!this._client) {
      const apiKey = this._getApiKey();
      if (!apiKey) {
        throw new Error('[GeminiEmbeddingProvider] GEMINI_API_KEY is not configured on the server.');
      }
      this._client = new GoogleGenerativeAIEmbeddings({
        model: this.modelName,
        apiKey
      });
    }
    return this._client;
  }

  /**
   * Generate 768-dim float vector for input text.
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async embed(text) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return new Array(this.dimension).fill(0);
    }
    const cleanText = text.slice(0, 8000).replace(/\s+/g, ' ').trim();
    const client = this._getClient();
    const vector = await client.embedQuery(cleanText);
    return vector;
  }

  /**
   * Generate 768-dim float vectors for a batch of input texts.
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async embedBatch(texts) {
    if (!Array.isArray(texts) || texts.length === 0) return [];
    const client = this._getClient();
    const cleanTexts = texts.map(t => (t || '').slice(0, 8000).replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (cleanTexts.length === 0) return [];
    return client.embedDocuments(cleanTexts);
  }

  getDimension() {
    return this.dimension;
  }

  getProviderName() {
    return 'gemini';
  }
}

module.exports = {
  GeminiEmbeddingProvider
};
