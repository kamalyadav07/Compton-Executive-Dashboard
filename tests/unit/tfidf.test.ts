/**
 * tests/unit/tfidf.test.ts
 * -----------------------------------------------------------------------
 * Unit tests for mathematical TF-IDF vector generation, sparse cosine similarity,
 * and exact hardware model / SKU bigram boosting.
 */

import { describe, it, expect } from 'vitest';
const { 
  buildTfidfVector, 
  calculateVectorCosineSimilarity,
  extractMeaningfulTerms,
  tokenize 
} = require('../../server/services/tfidfSearchService');

describe('Mathematical TF-IDF & Exact SKU Search Engine', () => {
  it('should tokenize text into meaningful unigrams and hyphenated SKUs', () => {
    const tokens = tokenize('FortiGate-100F Next-Gen Firewall with 48-port PoE');
    expect(tokens).toContain('fortigate-100f');
    expect(tokens).toContain('firewall');
    expect(tokens).toContain('48-port');
    expect(tokens).toContain('poe');
  });

  it('should extract meaningful terms and bigrams', () => {
    const terms = extractMeaningfulTerms('FortiGate 100F Firewall');
    expect(terms).toContain('fortigate');
    expect(terms).toContain('100f');
    expect(terms).toContain('firewall');
    expect(terms).toContain('fortigate_100f');
  });

  it('should compute valid L2-normalized sparse TF-IDF vector', () => {
    const docFreqs = { fortigate: 1, '100f': 1, firewall: 2 };
    const totalDocs = 3;
    const terms = ['fortigate', '100f', 'firewall'];

    const vector = buildTfidfVector(terms, totalDocs, docFreqs);
    expect(Object.keys(vector).length).toBe(3);

    // Compute magnitude
    let sumSq = 0;
    Object.values(vector).forEach(w => { sumSq += (w as number) ** 2; });
    expect(Math.sqrt(sumSq)).toBeCloseTo(1.0, 1);
  });

  it('should compute exact cosine similarity between sparse vectors', () => {
    const vecA = { fortigate: 0.7071, firewall: 0.7071 };
    const vecB = { fortigate: 0.7071, firewall: 0.7071 };
    const vecC = { cisco: 0.7071, switch: 0.7071 };

    const simIdentical = calculateVectorCosineSimilarity(vecA, vecB);
    const simOrthogonal = calculateVectorCosineSimilarity(vecA, vecC);

    expect(simIdentical).toBeCloseTo(1.0, 2);
    expect(simOrthogonal).toBe(0.0);
  });
});
