/**
 * server/salesTargets.js
 * -----------------------------------------------------------------------
 * CommonJS export of sales targets for backend server & LangChain tools.
 */

const COMPANY_MONTHLY_TARGET = 16000000;  // ₹1.6 Crore / month
const COMPANY_YEARLY_TARGET  = 200000000; // ₹20 Crore / FY (Apr–Mar)

const INDIVIDUAL_REP_MONTHLY_TARGETS = {
  'Sandeep Vahi':   3950000, // ₹39.5L
  'Rohit Yadav':    7500000, // ₹75L
  'Jitesh Chander': 4000000, // ₹40L
  'Taniya Negi':     550000, // ₹5.5L
};

function getTargets() {
  return {
    monthlyTarget: COMPANY_MONTHLY_TARGET,
    yearlyTarget:  COMPANY_YEARLY_TARGET,
    repMonthlyTargets: INDIVIDUAL_REP_MONTHLY_TARGETS,
    repTargets: INDIVIDUAL_REP_MONTHLY_TARGETS,
  };
}

module.exports = {
  COMPANY_MONTHLY_TARGET,
  COMPANY_YEARLY_TARGET,
  INDIVIDUAL_REP_MONTHLY_TARGETS,
  getTargets,
};
