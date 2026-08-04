import type { BusinessRule, RuleValidationResult } from './types';
import type { DealRecord } from '../types/sales';

const INITIAL_RULES: BusinessRule[] = [
  {
    id: 'rule_won_date',
    name: 'Won Deal Date Constraint',
    description: 'Every Won deal must have a valid deal date recorded.',
    dealType: 'won',
    targetField: 'date',
    condition: 'required',
    version: 'v3.2',
    author: 'Data Governance Team',
    createdAt: '2026-07-15',
    isActive: true
  },
  {
    id: 'rule_lost_reason',
    name: 'Lost Deal Reason Requirement',
    description: 'Every Lost deal must specify a valid lost reason for churn analytics.',
    dealType: 'lost',
    targetField: 'lostReason',
    condition: 'required',
    version: 'v3.2',
    author: 'Sales Operations',
    createdAt: '2026-07-15',
    isActive: true
  },
  {
    id: 'rule_non_negative_revenue',
    name: 'Non-Negative Gross Revenue',
    description: 'Gross deal revenue must be greater than or equal to 0.',
    dealType: 'all',
    targetField: 'grossRevenue',
    condition: 'positive_number',
    version: 'v3.1',
    author: 'Finance & Risk',
    createdAt: '2026-06-01',
    isActive: true
  },
  {
    id: 'rule_progress_stage',
    name: 'In-Progress Stage Requirement',
    description: 'Pipeline deals must specify a active pipeline stage.',
    dealType: 'in_progress',
    targetField: 'stage',
    condition: 'required',
    version: 'v3.2',
    author: 'Pipeline Committee',
    createdAt: '2026-07-20',
    isActive: true
  }
];

export class BusinessRuleEngine {
  private rules: BusinessRule[] = [...INITIAL_RULES];
  private ruleExecutionLog: { timestamp: string; recordId: string; results: RuleValidationResult[] }[] = [];

  public getRules(): BusinessRule[] {
    return [...this.rules];
  }

  public updateRule(rule: BusinessRule) {
    const idx = this.rules.findIndex(r => r.id === rule.id);
    if (idx >= 0) {
      this.rules[idx] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  public toggleRule(ruleId: string): boolean {
    const r = this.rules.find(x => x.id === ruleId);
    if (r) {
      r.isActive = !r.isActive;
      return r.isActive;
    }
    return false;
  }

  public validateRecord(record: DealRecord): { passed: boolean; results: RuleValidationResult[] } {
    const results: RuleValidationResult[] = [];
    let allPassed = true;

    const applicableRules = this.rules.filter(r => r.isActive && (r.dealType === 'all' || r.dealType === record.type));

    for (const rule of applicableRules) {
      let passed = true;
      let msg = `Passed rule [${rule.version}] ${rule.name}`;

      if (rule.condition === 'required') {
        const val = (record as any)[rule.targetField];
        if (val === undefined || val === null || String(val).trim() === '') {
          passed = false;
          msg = `Failed rule [${rule.version}] ${rule.name}: ${rule.targetField} is required`;
        }
      } else if (rule.condition === 'positive_number') {
        const val = (record as any)[rule.targetField];
        if (typeof val !== 'number' || isNaN(val) || val < 0) {
          passed = false;
          msg = `Failed rule [${rule.version}] ${rule.name}: ${rule.targetField} must be >= 0`;
        }
      }

      if (!passed) {
        allPassed = false;
      }

      results.push({
        passed,
        ruleId: rule.id,
        ruleVersion: rule.version,
        message: msg,
        field: rule.targetField
      });
    }

    this.ruleExecutionLog.unshift({
      timestamp: new Date().toISOString(),
      recordId: record.id,
      results
    });
    if (this.ruleExecutionLog.length > 300) this.ruleExecutionLog.pop();

    return { passed: allPassed, results };
  }

  public getExecutionLog() {
    return this.ruleExecutionLog;
  }
}

export const globalBusinessRuleEngine = new BusinessRuleEngine();
