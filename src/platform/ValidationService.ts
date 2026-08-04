import type { DealRecord } from '../types/sales';

// Masters for Referential Integrity Validation (Item 12)
export const EMPLOYEE_MASTER = [
  'Kamal',
  'Priya Sharma',
  'Rahul Verma',
  'Ananya Iyer',
  'Vikram Malhotra',
  'Neha Gupta',
  'Rajesh Patel',
  'Kavita Reddy'
];

export const INDUSTRY_MASTER = [
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

    if (record.salesRep && !EMPLOYEE_MASTER.some(e => e.toLowerCase() === record.salesRep?.toLowerCase())) {
      salesRepValid = false;
      errors.push(`Sales rep '${record.salesRep}' not found in Employee Master`);
    }

    if (record.industry && !INDUSTRY_MASTER.some(i => i.toLowerCase() === record.industry?.toLowerCase())) {
      industryValid = false;
      errors.push(`Industry '${record.industry}' not found in Industry Master`);
    }

    return {
      valid: salesRepValid && industryValid,
      salesRepValid,
      industryValid,
      errors
    };
  }

  // DQI Score Computation (Item 2 & 25)
  public calculateDQIScore(records: DealRecord[]): number {
    if (!records || records.length === 0) return 100;

    let validCount = 0;
    records.forEach(r => {
      let passed = true;
      if (!r.customer || r.customer.trim() === '') passed = false;
      if (typeof r.grossRevenue !== 'number' || isNaN(r.grossRevenue) || r.grossRevenue < 0) passed = false;
      if (!r.salesRep) passed = false;
      if (!r.date) passed = false;
      if (passed) validCount++;
    });

    const score = Math.round((validCount / records.length) * 100);
    return Math.max(0, Math.min(100, score));
  }
}

export const globalValidationService = new ValidationService();
