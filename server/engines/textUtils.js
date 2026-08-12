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

// ../src/utils/textUtils.ts
var textUtils_exports = {};
__export(textUtils_exports, {
  cleanDealTitle: () => cleanDealTitle,
  formatDealLabel: () => formatDealLabel
});
module.exports = __toCommonJS(textUtils_exports);
function cleanDealTitle(rawTitle) {
  if (!rawTitle) return "";
  let cleaned = String(rawTitle);
  cleaned = cleaned.replace(/<[^>]+>/g, " ");
  cleaned = cleaned.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  cleaned = cleaned.replace(/[*_`~]/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}
function formatDealLabel(title, dealId) {
  const clean = cleanDealTitle(title);
  if (!clean) return dealId ? `Deal (${dealId})` : "Untitled Deal";
  if (dealId && !clean.toLowerCase().includes(dealId.toLowerCase())) {
    return `${clean} (${dealId})`;
  }
  return clean;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cleanDealTitle,
  formatDealLabel
});
