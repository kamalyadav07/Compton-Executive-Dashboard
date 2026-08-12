var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../src/utils/financeUtils.ts
var financeUtils_exports = {};
__export(financeUtils_exports, {
  GST_RATE: () => GST_RATE,
  displayWonAmount: () => displayWonAmount,
  reconcileGst: () => reconcileGst,
  splitGst: () => splitGst
});
module.exports = __toCommonJS(financeUtils_exports);
var GST_RATE = 0.18;
function splitGst(grossRevenue, isWon) {
  const gross = Number.isFinite(grossRevenue) ? grossRevenue : 0;
  if (!isWon) {
    return { netRevenue: gross, gstAmount: 0 };
  }
  const netRevenue = Math.round(gross / (1 + GST_RATE) * 100) / 100;
  const gstAmount = Math.round((gross - netRevenue) * 100) / 100;
  return { netRevenue, gstAmount };
}
function displayWonAmount(grossRevenue, type) {
  return splitGst(grossRevenue, type === "won").netRevenue;
}
function reconcileGst(grossRevenue, isWon, bitrixTaxValue) {
  const computed = splitGst(grossRevenue, isWon);
  const taxVal = typeof bitrixTaxValue === "string" ? parseFloat(bitrixTaxValue) : bitrixTaxValue;
  if (isWon && taxVal && taxVal > 0) {
    const expected = computed.gstAmount;
    const withinTolerance = expected === 0 ? true : Math.abs(taxVal - expected) / expected <= 0.05;
    if (withinTolerance) {
      return {
        netRevenue: Math.round((grossRevenue - taxVal) * 100) / 100,
        gstAmount: Math.round(taxVal * 100) / 100,
        source: "bitrix"
      };
    }
  }
  return { ...computed, source: "computed" };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GST_RATE,
  displayWonAmount,
  reconcileGst,
  splitGst
});
