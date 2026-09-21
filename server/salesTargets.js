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

// src/config/salesTargets.ts
var salesTargets_exports = {};
__export(salesTargets_exports, {
  COMPANY_MONTHLY_TARGET: () => COMPANY_MONTHLY_TARGET,
  COMPANY_YEARLY_TARGET: () => COMPANY_YEARLY_TARGET,
  INDIVIDUAL_REP_MONTHLY_TARGETS: () => INDIVIDUAL_REP_MONTHLY_TARGETS,
  getTargets: () => getTargets
});
module.exports = __toCommonJS(salesTargets_exports);
const fs = require('fs');
const path = require('path');

var COMPANY_MONTHLY_TARGET = 16e6;
var COMPANY_YEARLY_TARGET = 2e8;
var INDIVIDUAL_REP_MONTHLY_TARGETS = {
  "Sandeep Vahi": 395e4,
  "Rohit Yadav": 75e5,
  "Jitesh Chander": 4e6,
  "Taniya Negi": 55e4
};

function checkConfig() {
  try {
    const configPath = path.join(__dirname, 'targets_config.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.monthlyTarget) COMPANY_MONTHLY_TARGET = data.monthlyTarget;
      if (data.yearlyTarget) COMPANY_YEARLY_TARGET = data.yearlyTarget;
      if (data.repTargets) {
        for (const k of Object.keys(INDIVIDUAL_REP_MONTHLY_TARGETS)) {
          delete INDIVIDUAL_REP_MONTHLY_TARGETS[k];
        }
        Object.assign(INDIVIDUAL_REP_MONTHLY_TARGETS, data.repTargets);
      }
    }
  } catch (_) {}
}
checkConfig();

function getTargets() {
  checkConfig();
  return {
    monthlyTarget: COMPANY_MONTHLY_TARGET,
    yearlyTarget: COMPANY_YEARLY_TARGET,
    repMonthlyTargets: INDIVIDUAL_REP_MONTHLY_TARGETS,
    repTargets: INDIVIDUAL_REP_MONTHLY_TARGETS
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  COMPANY_MONTHLY_TARGET,
  COMPANY_YEARLY_TARGET,
  INDIVIDUAL_REP_MONTHLY_TARGETS,
  getTargets
});
