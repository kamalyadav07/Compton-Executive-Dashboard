/**
 * financeUtils.ts
 * -----------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for GST math.
 *
 * WHY THIS FILE EXISTS:
 * Today the "remove 18% GST from won deals" formula is copy-pasted in
 * THREE different places:
 *   1. src/engine/bitrixService.ts  -> fetchBitrixDeals()
 *   2. src/engine/bitrixService.ts  -> getStoredBitrixCache() sanitizer
 *   3. (implicitly again anywhere netRevenue is recomputed in components)
 *
 * Three copies of the same formula is exactly how "data comes wrong in
 * some places" bugs are born — the day someone tweaks the formula in one
 * spot (e.g. changes rounding, or GST % ) and forgets the other two, the
 * dashboard and the chatbot will silently disagree with each other.
 *
 * Rule going forward: NOTHING in the app computes GST/net revenue
 * inline. Everything imports from here.
 */

export const GST_RATE = 0.18;

/**
 * Given a gross (GST-inclusive) amount on a WON deal, return the net
 * revenue with GST removed, and the GST amount itself.
 * Non-won deals are passed through unchanged (gross === net, gst = 0)
 * because GST only applies to invoiced/won revenue.
 */
export function splitGst(grossRevenue: number, isWon: boolean): { netRevenue: number; gstAmount: number } {
  const gross = Number.isFinite(grossRevenue) ? grossRevenue : 0;
  if (!isWon) {
    return { netRevenue: gross, gstAmount: 0 };
  }
  const netRevenue = Math.round((gross / (1 + GST_RATE)) * 100) / 100;
  const gstAmount = Math.round((gross - netRevenue) * 100) / 100;
  return { netRevenue, gstAmount };
}

/**
 * Convenience helper for anywhere in the UI that just wants "the number
 * to display" for a deal's won amount. This is the ONLY function any
 * chart / KPI card / chatbot answer should call to get a displayable
 * won-amount figure.
 */
export function displayWonAmount(grossRevenue: number, type: 'won' | 'lost' | 'in_progress'): number {
  return splitGst(grossRevenue, type === 'won').netRevenue;
}

/**
 * Bitrix sometimes sends an authoritative TAX_VALUE field. Prefer it when
 * present and sane (i.e. not 0 and not wildly different from the 18%
 * expectation), otherwise fall back to the computed 18% split. This
 * matches finance's real invoices instead of silently trusting an
 * assumed flat rate when Bitrix disagrees.
 */
export function reconcileGst(grossRevenue: number, isWon: boolean, bitrixTaxValue?: number | string): { netRevenue: number; gstAmount: number; source: 'bitrix' | 'computed' } {
  const computed = splitGst(grossRevenue, isWon);
  const taxVal = typeof bitrixTaxValue === 'string' ? parseFloat(bitrixTaxValue) : bitrixTaxValue;

  if (isWon && taxVal && taxVal > 0) {
    const expected = computed.gstAmount;
    // If Bitrix's own tax value is within 5% of what we'd expect from an
    // 18% flat computation, trust Bitrix (it's the source of truth entered
    // by the sales rep / finance). Otherwise Bitrix's field is probably
    // stale/blank/mis-entered — fall back to the computed value so a bad
    // manual entry doesn't corrupt the dashboard.
    const withinTolerance = expected === 0 ? true : Math.abs(taxVal - expected) / expected <= 0.05;
    if (withinTolerance) {
      return {
        netRevenue: Math.round((grossRevenue - taxVal) * 100) / 100,
        gstAmount: Math.round(taxVal * 100) / 100,
        source: 'bitrix'
      };
    }
  }
  return { ...computed, source: 'computed' };
}
