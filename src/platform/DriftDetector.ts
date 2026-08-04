import type { DriftAlert, EnhancedDealRecord } from './types';

export class DriftDetector {
  private alerts: DriftAlert[] = [];
  private baselineAvgRevenue: number = 250000;
  private baselineWonDealsCount: number = 50;

  public detectDrift(
    syncJobId: string,
    currentRecords: EnhancedDealRecord[]
  ): DriftAlert[] {
    const newAlerts: DriftAlert[] = [];
    if (!currentRecords || currentRecords.length === 0) return newAlerts;

    const wonRecords = currentRecords.filter(r => r.type === 'won');
    const totalRev = wonRecords.reduce((sum, r) => sum + r.grossRevenue, 0);
    const currentAvgRev = wonRecords.length > 0 ? totalRev / wonRecords.length : 0;
    const currentWonCount = wonRecords.length;

    // 1. Average Revenue Drift Check (> 300% change spike or crash)
    if (this.baselineAvgRevenue > 0 && currentAvgRev > 0) {
      const changeRatio = Math.abs(currentAvgRev - this.baselineAvgRevenue) / this.baselineAvgRevenue;
      if (changeRatio > 1.5) { // 150% shift threshold
        const alert: DriftAlert = {
          id: `drift_${Date.now()}_1`,
          metricName: 'Average Gross Revenue',
          previousValue: Math.round(this.baselineAvgRevenue),
          currentValue: Math.round(currentAvgRev),
          changePct: Math.round(changeRatio * 100),
          thresholdPct: 150,
          severity: changeRatio > 4 ? 'critical' : 'high',
          detectedAt: new Date().toISOString(),
          syncJobId,
          description: `Average revenue drifted from ₹${(this.baselineAvgRevenue/100000).toFixed(2)} Lakh to ₹${(currentAvgRev/100000).toFixed(2)} Lakh.`
        };
        newAlerts.push(alert);
      }
    }

    // 2. Won Deals Volume Crash Check (e.g. 50 -> 2)
    if (this.baselineWonDealsCount > 10 && currentWonCount < 5) {
      const alert: DriftAlert = {
        id: `drift_${Date.now()}_2`,
        metricName: 'Won Deals Volume',
        previousValue: this.baselineWonDealsCount,
        currentValue: currentWonCount,
        changePct: Math.round(((this.baselineWonDealsCount - currentWonCount) / this.baselineWonDealsCount) * 100),
        thresholdPct: 80,
        severity: 'critical',
        detectedAt: new Date().toISOString(),
        syncJobId,
        description: `Won deals volume dropped precipitously from ${this.baselineWonDealsCount} to ${currentWonCount}.`
      };
      newAlerts.push(alert);
    }

    // Store alerts
    newAlerts.forEach(a => {
      this.alerts.unshift(a);
    });
    if (this.alerts.length > 50) this.alerts.length = 50;

    return newAlerts;
  }

  public getAlerts(): DriftAlert[] {
    return [...this.alerts];
  }

  public updateBaselines(avgRev: number, wonCount: number) {
    if (avgRev > 0) this.baselineAvgRevenue = avgRev;
    if (wonCount > 0) this.baselineWonDealsCount = wonCount;
  }
}

export const globalDriftDetector = new DriftDetector();
