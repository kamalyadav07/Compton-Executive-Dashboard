/**
 * server/services/numericalGroundingValidator.js
 * -----------------------------------------------------------------------
 * Post-Response Numerical Grounding Validator.
 *
 * Verifies that every monetary figure, count, percentage, and metric stated
 * in the LLM's prose is strictly grounded in the deterministic tool outputs.
 */

// Common benign numbers allowed in prose (e.g., column indices, basic thresholds, standard months)
const BENIGN_NUMBERS = new Set([
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12', '15', '18', '20', '24', '30', '31',
  '100', '365', '2024', '2025', '2026', '2027'
]);

/**
 * Extract all scalar numeric values from a nested JSON tool output object or array.
 */
function extractNumbersFromToolOutputs(toolOutputs) {
  const numbers = new Set();

  function traverse(obj) {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'number') {
      if (Number.isFinite(obj)) {
        numbers.add(Math.round(obj));
        numbers.add(Math.round(obj * 10) / 10);
        numbers.add(Math.round(obj * 100) / 100);

        // Also add Lakh & Crore conversions
        // 1 Lakh = 100,000
        const inLakh = obj / 100000;
        numbers.add(Math.round(inLakh));
        numbers.add(Math.round(inLakh * 10) / 10);
        numbers.add(Math.round(inLakh * 100) / 100);

        // 1 Crore = 10,000,000
        const inCrore = obj / 10000000;
        numbers.add(Math.round(inCrore));
        numbers.add(Math.round(inCrore * 10) / 10);
        numbers.add(Math.round(inCrore * 100) / 100);
      }
    } else if (typeof obj === 'string') {
      // Find all numbers inside string values
      const matches = obj.match(/-?\d+(\.\d+)?/g);
      if (matches) {
        matches.forEach(m => {
          const parsed = parseFloat(m);
          if (Number.isFinite(parsed)) {
            numbers.add(Math.round(parsed));
            numbers.add(Math.round(parsed * 10) / 10);
          }
        });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(item => traverse(item));
    } else if (typeof obj === 'object') {
      Object.values(obj).forEach(val => traverse(val));
    }
  }

  if (Array.isArray(toolOutputs)) {
    toolOutputs.forEach(out => {
      try {
        const parsed = typeof out === 'string' ? JSON.parse(out) : out;
        traverse(parsed);
        // Also add sum of netRevenue/grossRevenue/values if deals array exists
        if (parsed && Array.isArray(parsed.deals)) {
          const sumNet = parsed.deals.reduce((s, d) => s + (d.netRevenue || d.grossRevenue || 0), 0);
          if (sumNet > 0) traverse(sumNet);
        }
      } catch (_) {
        traverse(out);
      }
    });
  } else {
    traverse(toolOutputs);
  }

  return numbers;
}

/**
 * Extract all numbers mentioned in the LLM's response prose.
 */
function extractNumbersFromProse(prose) {
  if (!prose || typeof prose !== 'string') return [];

  // Match monetary and numeric patterns like ₹45,00,000, 45.2 Lakh, 95%, 1,219 deals
  const clean = prose.replace(/BITRIX-\d+/gi, '').replace(/\b202[4-7]-\d{2}(-\d{2})?\b/g, '');
  const matches = clean.match(/\d+(?:,\d+)*(?:\.\d+)?/g) || [];

  return matches.map(m => {
    const rawClean = m.replace(/,/g, '');
    return {
      raw: m,
      value: parseFloat(rawClean)
    };
  }).filter(n => Number.isFinite(n.value));
}

/**
 * Validate that numbers in the response prose are grounded in tool outputs.
 *
 * @param {string} prose - LLM generated answer
 * @param {Array} rawToolOutputs - Array of tool outputs or raw JSON
 * @returns {Object} { isValid: boolean, ungroundedNumbers: Array, groundedCount: number }
 */
function validateNumericalGrounding(prose, rawToolOutputs = []) {
  if (!prose || typeof prose !== 'string') {
    return { isValid: true, ungroundedNumbers: [], groundedCount: 0 };
  }

  const allowedPool = extractNumbersFromToolOutputs(rawToolOutputs);
  const proseNumbers = extractNumbersFromProse(prose);

  const ungrounded = [];
  let groundedCount = 0;

  for (const item of proseNumbers) {
    const rounded = Math.round(item.value);
    const rounded1 = Math.round(item.value * 10) / 10;
    const rounded2 = Math.round(item.value * 100) / 100;
    const strVal = String(rounded);

    if (BENIGN_NUMBERS.has(strVal)) {
      continue;
    }

    if (allowedPool.has(rounded) || allowedPool.has(rounded1) || allowedPool.has(rounded2)) {
      groundedCount++;
    } else {
      ungrounded.push(item.raw);
    }
  }

  const isValid = ungrounded.length === 0;
  if (!isValid) {
    console.warn(`[NUMERICAL GROUNDING WARNING] Detected ungrounded numbers in response: ${ungrounded.join(', ')}`);
  }

  return {
    isValid,
    ungroundedNumbers: ungrounded,
    groundedCount,
    totalNumbersEvaluated: proseNumbers.length
  };
}

module.exports = {
  validateNumericalGrounding,
  extractNumbersFromToolOutputs,
  extractNumbersFromProse
};
