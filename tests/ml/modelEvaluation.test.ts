/**
 * tests/ml/modelEvaluation.test.ts
 * -----------------------------------------------------------------------
 * ML Unit & Evaluation Tests:
 *   - L2 Logistic Regression parameter convergence
 *   - Prediction probability bounds [0, 1]
 *   - ROC-AUC, Brier score, and Platt scaling calibration reduction
 */

import { describe, it, expect } from 'vitest';
const { 
  LogisticRegressionWinModel, 
  computeClassificationMetrics 
} = require('../../server/services/ml/winProbabilityModel');
const { 
  PlattCalibrator, 
  computeCalibrationCurve 
} = require('../../server/services/ml/calibrationEngine');
const { 
  extractFeaturesFromDeal 
} = require('../../server/services/ml/featureStoreService');

describe('ML Model 1 Training, Calibration & Evaluation Suite', () => {
  it('should train logistic regression model on fixture and produce non-degenerate weights', () => {
    const XTrain = [
      [1.0, 0.8, 0.2, 0.7],
      [0.9, 0.7, 0.3, 0.6],
      [0.2, 0.3, 0.8, 0.2],
      [0.1, 0.2, 0.9, 0.1]
    ];
    const yTrain = [1, 1, 0, 0];

    const model = new LogisticRegressionWinModel({
      learningRate: 0.1,
      l2Lambda: 0.01,
      epochs: 200
    });

    model.train(XTrain, yTrain, XTrain, yTrain);

    expect(model.weights.length).toBe(4);
    model.weights.forEach((w: number) => {
      expect(Number.isFinite(w)).toBe(true);
      expect(isNaN(w)).toBe(false);
    });
  });

  it('should predict probabilities strictly bounded in [0, 1]', () => {
    const model = new LogisticRegressionWinModel();
    model.weights = [1.2, -0.8, 0.5, 0.9];
    model.bias = -0.2;
    model.scalerMeans = [0.5, 0.5, 0.5, 0.5];
    model.scalerStds = [0.2, 0.2, 0.2, 0.2];

    const testVectors = [
      [10.0, -5.0, 3.0, 4.0],
      [-10.0, 15.0, -8.0, -9.0],
      [0.5, 0.5, 0.5, 0.5]
    ];

    const probs = model.predictProbabilities(testVectors);
    probs.forEach((p: number) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });

  it('should compute exact ROC-AUC and Brier scores on ground truth fixture', () => {
    const yTrue = [1, 1, 0, 0];
    const yProb = [0.9, 0.8, 0.2, 0.1];

    const metrics = computeClassificationMetrics(yTrue, yProb);
    expect(metrics.auc).toBe(1.0);
    expect(metrics.brierScore).toBeLessThan(0.05);
    expect(metrics.accuracy).toBe(1.0);
  });

  it('should fit Platt Scaling and reduce calibration error', () => {
    const yTrue = [1, 1, 1, 0, 0, 0];
    const yRaw = [0.65, 0.70, 0.75, 0.40, 0.45, 0.50];

    const platt = new PlattCalibrator();
    platt.fit(yTrue, yRaw);

    const yCal = platt.transformArray(yRaw);
    const rawReport = computeCalibrationCurve(yTrue, yRaw);
    const calReport = computeCalibrationCurve(yTrue, yCal);

    expect(calReport.brierScore).toBeLessThanOrEqual(rawReport.brierScore);
  });

  it('should require an explicit asOfDate in extractFeaturesFromDeal to prevent temporal leakage', () => {
    const deal = {
      gross_revenue: 50000,
      stage_name: 'Proposal',
      created_at: '2024-01-01T00:00:00Z',
      sales_rep_name: 'Sarah Chen'
    };

    // Should throw if asOfDate is missing or undefined
    expect(() => (extractFeaturesFromDeal as any)(deal, {})).toThrow(
      /asOfDate is required to prevent temporal leakage/
    );

    // Should throw if asOfDate is invalid
    expect(() => (extractFeaturesFromDeal as any)(deal, {}, 'invalid-date')).toThrow(
      /Invalid asOfDate/
    );
  });

  it('should produce different totalAgeDays for the same deal when given different asOfDate values', () => {
    const deal = {
      gross_revenue: 75000,
      stage_name: 'Negotiation',
      created_at: '2024-01-01T00:00:00Z',
      sales_rep_name: 'Sarah Chen'
    };

    const asOfClose = new Date('2024-01-31T00:00:00Z'); // 30 days after creation
    const asOfLater = new Date('2024-04-01T00:00:00Z'); // 91 days after creation
    const asOfFarFuture = new Date('2025-01-01T00:00:00Z'); // 366 days after creation

    const featClose = extractFeaturesFromDeal(deal, {}, asOfClose);
    const featLater = extractFeaturesFromDeal(deal, {}, asOfLater);
    const featFarFuture = extractFeaturesFromDeal(deal, {}, asOfFarFuture);

    expect(featClose.raw.total_deal_age_days).toBe(30);
    expect(featLater.raw.total_deal_age_days).toBe(91);
    expect(featFarFuture.raw.total_deal_age_days).toBe(366);

    expect(featClose.raw.total_deal_age_days).not.toBe(featLater.raw.total_deal_age_days);
    expect(featLater.raw.total_deal_age_days).not.toBe(featFarFuture.raw.total_deal_age_days);
  });
});
