/**
 * tests/unit/finance.test.ts
 * -----------------------------------------------------------------------
 * Unit tests for GST calculation (18% split) & Net Revenue conversion.
 */

import { describe, it, expect } from 'vitest';
import { splitGst } from '../../src/utils/financeUtils';

describe('GST Calculation & Net Revenue Engine', () => {
  it('should remove 18% GST on WON deals', () => {
    // ₹1,18,000 gross with 18% GST -> ₹1,00,000 net, ₹18,000 GST
    const result = splitGst(118000, true);
    expect(result.netRevenue).toBe(100000);
    expect(result.gstAmount).toBe(18000);
  });

  it('should NOT remove GST on open / in_progress deals', () => {
    // Open deals keep full gross value as net for pipeline tracking
    const result = splitGst(500000, false);
    expect(result.netRevenue).toBe(500000);
    expect(result.gstAmount).toBe(0);
  });

  it('should handle decimal monetary figures with exact 2-decimal rounding', () => {
    const result = splitGst(100000, true);
    // 100000 / 1.18 = 84745.7627... -> 84745.76
    expect(result.netRevenue).toBe(84745.76);
    expect(result.gstAmount).toBe(15254.24);
  });

  it('should gracefully handle zero and invalid inputs', () => {
    expect(splitGst(0, true).netRevenue).toBe(0);
    expect(splitGst(-500, true).netRevenue).toBe(0);
  });
});
