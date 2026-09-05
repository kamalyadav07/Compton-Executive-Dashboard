/**
 * src/platform/ValidationService.ts
 * -----------------------------------------------------------------------
 * Frontend Client Validation & Multi-Dimensional DQI Types.
 * Matches server/services/validationService.js.
 */

import type { DealRecord } from '../types/sales';

// Compton Sales Reps Master (Replaces legacy generic names)
export const SALES_REP_MASTER = [
  'Sandeep Vahi',
  'Rohit Yadav',
  'Jitesh Chander',
  'Taniya Negi',
  'Alka Rawat',
  'Sunil Kumar',
  'Akash Panwar',
  'Akshay Gupta',
  'Siddharth'
];

export const INDUSTRY_MASTER = [
  'General Industry',
  'Healthcare',
  'FinTech',
  'Retail',
  'Manufacturing',
  'Logistics',
  'EdTech',
  'SaaS & Software',
  'Energy & Utilities',
  'Automotive'
];

export interface DataQualityBreakdown {
  overallScore: number;
  completeness: number;
  uniqueness: number;
  validity: number;
  consistency: number;
  integrity: number;
  freshness: number;
  totalEvaluated: number;
  passedCount: number;
  failedCount: number;
}

export class ValidationService {
  public validateReferentialIntegrity(record: Partial<DealRecord>): {
    valid: boolean;
    salesRepValid: boolean;
    industryValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    let salesRepValid = true;
    let industryValid = true;

    if (record.salesRep && !SALES_REP_MASTER.some(e => e.toLowerCase() === record.salesRep?.toLowerCase())) {
      salesRepValid = false;
      errors.push(`Sales rep '${record.salesRep}' not in Rep Master`);
    }

    if (record.industry && !INDUSTRY_MASTER.some(i => i.toLowerCase() === record.industry?.toLowerCase())) {
      industryValid = false;
      errors.push(`Industry '${record.industry}' not in Industry Master`);
    }

    return {
      valid: salesRepValid && industryValid,
      salesRepValid,
      industryValid,
      errors
    };
  }

  /**
   * Computes a full 6-dimensional Data Quality breakdown across a list of DealRecords.
   */
  public compute6DDataQuality(records: DealRecord[]): DataQualityBreakdown {
    if (!records || records.length === 0) {
      return {
        overallScore: 100,
        completeness: 100,
        uniqueness: 100,
        validity: 100,
        consistency: 100,
        integrity: 100,
        freshness: 100,
        totalEvaluated: 0,
        passedCount: 0,
        failedCount: 0
      };
    }

    let sumCompleteness = 0;
    let sumValidity = 0;
    let sumConsistency = 0;
    let sumIntegrity = 0;
    let passedCount = 0;
    const seenIds = new Set<string>();
    let duplicateIds = 0;

    records.forEach(r => {
      let isRowValid = true;

      // 1. Completeness (title, customer, salesRep, stage, revenue, date)
      let cPassed = 0;
      if (r.id) cPassed++;
      if (r.customer && r.customer.trim() !== '') cPassed++; else isRowValid = false;
      if (r.salesRep && r.salesRep.trim() !== '') cPassed++; else isRowValid = false;
      if (r.stage && r.stage.trim() !== '') cPassed++; else isRowValid = false;
      if (typeof r.grossRevenue === 'number' && !isNaN(r.grossRevenue)) cPassed++; else isRowValid = false;
      if (r.date) cPassed++;
      sumCompleteness += (cPassed / 6);

      // 2. Uniqueness
      if (seenIds.has(r.id)) duplicateIds++;
      seenIds.add(r.id);

      // 3. Validity (revenue >= 0, netRevenue >= 0, status in enum)
      let vPassed = 0;
      if (r.grossRevenue >= 0) vPassed++; else isRowValid = false;
      if (r.netRevenue >= 0) vPassed++; else isRowValid = false;
      if (['won', 'lost', 'in_progress'].includes(r.type)) vPassed++; else isRowValid = false;
      if (typeof r.marginPct === 'number' && r.marginPct >= 0 && r.marginPct <= 100) vPassed++; else if (r.marginPct === undefined) vPassed++;
      if (typeof r.winProbability === 'number' && r.winProbability >= 0 && r.winProbability <= 100) vPassed++; else if (r.winProbability === undefined) vPassed++;
      sumValidity += (vPassed / 5);

      // 4. Consistency (netRevenue <= grossRevenue)
      let conPassed = 0;
      if (r.netRevenue <= r.grossRevenue + 1.0) conPassed++; else isRowValid = false;
      if (typeof r.salesCycleDays === 'number' && r.salesCycleDays >= 0) conPassed++; else if (r.salesCycleDays === undefined) conPassed++;
      if (typeof r.contractTermMonths === 'number' && r.contractTermMonths >= 0) conPassed++; else if (r.contractTermMonths === undefined) conPassed++;
      sumConsistency += (conPassed / 3);

      // 5. Integrity (salesRep in master, customer length >= 2)
      let iPassed = 0;
      if (SALES_REP_MASTER.some(e => e.toLowerCase() === (r.salesRep || '').toLowerCase())) iPassed++;
      if (r.customer && r.customer.length >= 2) iPassed++; else isRowValid = false;
      sumIntegrity += (iPassed / 2);

      if (isRowValid) passedCount++;
    });

    const count = records.length;
    const completeness = Math.round((sumCompleteness / count) * 1000) / 10;
    const uniqueness = Math.round(((count - duplicateIds) / count) * 1000) / 10;
    const validity = Math.round((sumValidity / count) * 1000) / 10;
    const consistency = Math.round((sumConsistency / count) * 1000) / 10;
    const integrity = Math.round((sumIntegrity / count) * 1000) / 10;
    const freshness = 100.0;

    const overallScore = Math.round(
      (completeness * 0.20 +
       uniqueness * 0.15 +
       validity * 0.25 +
       consistency * 0.15 +
       integrity * 0.15 +
       freshness * 0.10) * 10
    ) / 10;

    return {
      overallScore,
      completeness,
      uniqueness,
      validity,
      consistency,
      integrity,
      freshness,
      totalEvaluated: count,
      passedCount,
      failedCount: count - passedCount
    };
  }

  // Legacy compatibility wrapper
  public calculateDQIScore(records: DealRecord[]): number {
    return this.compute6DDataQuality(records).overallScore;
  }
}

export const globalValidationService = new ValidationService();
