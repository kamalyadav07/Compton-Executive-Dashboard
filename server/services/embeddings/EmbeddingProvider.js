/**
 * server/services/embeddings/EmbeddingProvider.js
 * -----------------------------------------------------------------------
 * Abstract Base Class for Swappable Embedding Providers.
 * Ensures vendor-agnostic semantic embedding generation.
 */

class EmbeddingProvider {
  /**
   * Generates a dense vector embedding for a single text string.
   * @param {string} text - The input text to embed.
   * @returns {Promise<number[]>} Array of floating point numbers.
   */
  async embed(text) {
    throw new Error(`[${this.getProviderName()}] embed() method not implemented.`);
  }

  /**
   * Generates dense vector embeddings for a batch of text strings.
   * @param {string[]} texts - Array of input strings.
   * @returns {Promise<number[][]>} Array of float arrays.
   */
  async embedBatch(texts) {
    if (!Array.isArray(texts) || texts.length === 0) return [];
    return Promise.all(texts.map(t => this.embed(t)));
  }

  /**
   * Returns the vector dimension produced by this model.
   * @returns {number}
   */
  getDimension() {
    return 768;
  }

  /**
   * Returns human-readable provider identifier.
   * @returns {string}
   */
  getProviderName() {
    return 'BaseEmbeddingProvider';
  }
}

module.exports = {
  EmbeddingProvider
};
