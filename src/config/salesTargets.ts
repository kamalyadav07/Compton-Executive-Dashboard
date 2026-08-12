/**
 * src/config/salesTargets.ts
 * -----------------------------------------------------------------------
 * Single source of truth for company and individual sales rep targets.
 */

export const COMPANY_MONTHLY_TARGET = 16000000;  // ₹1.6 Crore / month
export const COMPANY_YEARLY_TARGET  = 200000000; // ₹20 Crore / FY (Apr–Mar)

export const INDIVIDUAL_REP_MONTHLY_TARGETS: Record<string, number> = {
  'Sandeep Vahi':   3950000, // ₹39.5L
  'Rohit Yadav':    7500000, // ₹75L
  'Jitesh Chander': 4000000, // ₹40L
  'Taniya Negi':     550000, // ₹5.5L
};

export function getTargets() {
  return {
    monthlyTarget: COMPANY_MONTHLY_TARGET,
    yearlyTarget: COMPANY_YEARLY_TARGET,
    repMonthlyTargets: INDIVIDUAL_REP_MONTHLY_TARGETS
  };
}
