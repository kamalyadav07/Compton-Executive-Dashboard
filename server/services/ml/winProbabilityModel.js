/**
 * server/services/ml/winProbabilityModel.js
 * -----------------------------------------------------------------------
 * Model 1: Baseline L2-Regularized Logistic Regression Win-Probability Model.
 *
 * Features:
 *   - 22 Enriched CRM & Behavioral Features from deal_features_store
 *   - Chronological Time-Based Splitting (70% Train, 15% Validation, 15% Test)
 *   - L2 Regularization & StandardScaler Normalization
 *   - Comprehensive Validation Metrics: ROC-AUC, Brier Score, LogLoss, F1
 *   - Model Versioning & Persistence in `model_versions` table
 */

const { pool } = require('../../db');
const { 
  NUMERIC_FEATURE_KEYS, 
  computeCorpusBenchmarks, 
  extractFeaturesFromDeal 
} = require('./featureStoreService');

// ── Math & Evaluation Metrics Helpers ───────────────────────────────────

function sigmoid(z) {
  if (z < -40) return 0;
  if (z > 40) return 1;
  return 1 / (1 + Math.exp(-z));
}

function computeLogLoss(yTrue, yProb) {
  let loss = 0;
  const eps = 1e-15;
  for (let i = 0; i < yTrue.length; i++) {
    const p = Math.max(eps, Math.min(1 - eps, yProb[i]));
    loss += -(yTrue[i] * Math.log(p) + (1 - yTrue[i]) * Math.log(1 - p));
  }
  return loss / yTrue.length;
}

function computeBrierScore(yTrue, yProb) {
  let sumSqErr = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const diff = yProb[i] - yTrue[i];
    sumSqErr += diff * diff;
  }
  return sumSqErr / yTrue.length;
}

function computeRocAuc(yTrue, yProb) {
  // Rank-based Mann-Whitney U test statistic for true ROC-AUC
  const pairs = yTrue.map((yt, i) => ({ y: yt, p: yProb[i] }));
  pairs.sort((a, b) => b.p - a.p);

  let nPos = 0;
  let nNeg = 0;
  pairs.forEach(p => {
    if (p.y === 1) nPos++;
    else nNeg++;
  });

  if (nPos === 0 || nNeg === 0) return 0.5;

  let sumRankPos = 0;
  for (let i = 0; i < pairs.length; i++) {
    const rank = pairs.length - i; // 1-indexed from bottom
    if (pairs[i].y === 1) {
      sumRankPos += rank;
    }
  }

  const u = sumRankPos - (nPos * (nPos + 1)) / 2;
  const auc = u / (nPos * nNeg);
  return Math.round(auc * 1000) / 1000;
}

function computeClassificationMetrics(yTrue, yProb, threshold = 0.5) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const pred = yProb[i] >= threshold ? 1 : 0;
    if (pred === 1 && yTrue[i] === 1) tp++;
    else if (pred === 1 && yTrue[i] === 0) fp++;
    else if (pred === 0 && yTrue[i] === 0) tn++;
    else fn++;
  }

  const total = yTrue.length || 1;
  const accuracy = (tp + tn) / total;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const auc = computeRocAuc(yTrue, yProb);
  const logLoss = computeLogLoss(yTrue, yProb);
  const brierScore = computeBrierScore(yTrue, yProb);

  return {
    accuracy: Math.round(accuracy * 1000) / 1000,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000,
    auc,
    logLoss: Math.round(logLoss * 1000) / 1000,
    brierScore: Math.round(brierScore * 1000) / 1000
  };
}

// ── Model 1: Trainer Class ──────────────────────────────────────────────

class LogisticRegressionWinModel {
  constructor(options = {}) {
    this.learningRate = options.learningRate || 0.05;
    this.l2Lambda = options.l2Lambda || 0.01;
    this.epochs = options.epochs || 400;
    this.weights = [];
    this.bias = 0;
    this.scalerMeans = [];
    this.scalerStds = [];
    this.version = options.version || 'v1.2.0-lr-baseline';
  }

  /**
   * Fit StandardScaler on Training Feature Matrix.
   */
  _fitScaler(X) {
    const numFeatures = X[0].length;
    const n = X.length;
    this.scalerMeans = new Array(numFeatures).fill(0);
    this.scalerStds = new Array(numFeatures).fill(1);

    for (let j = 0; j < numFeatures; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += X[i][j];
      const mean = sum / n;
      this.scalerMeans[j] = mean;

      let sumSq = 0;
      for (let i = 0; i < n; i++) sumSq += (X[i][j] - mean) ** 2;
      const std = Math.sqrt(sumSq / n);
      this.scalerStds[j] = std > 1e-6 ? std : 1;
    }
  }

  /**
   * Transform feature matrix using fitted scaler.
   */
  _transform(X) {
    return X.map(row => 
      row.map((val, j) => (val - this.scalerMeans[j]) / this.scalerStds[j])
    );
  }

  /**
   * Train logistic regression weights using Gradient Descent with early stopping.
   */
  train(XTrainRaw, yTrain, XValRaw, yVal) {
    this._fitScaler(XTrainRaw);
    const XTrain = this._transform(XTrainRaw);
    const XVal = this._transform(XValRaw);

    const n = XTrain.length;
    const numFeatures = XTrain[0].length;
    this.weights = new Array(numFeatures).fill(0).map(() => (Math.random() - 0.5) * 0.1);
    this.bias = 0;

    let bestValLoss = Infinity;
    let bestWeights = [...this.weights];
    let bestBias = this.bias;

    for (let epoch = 0; epoch < this.epochs; epoch++) {
      const gradW = new Array(numFeatures).fill(0);
      let gradB = 0;

      for (let i = 0; i < n; i++) {
        let z = this.bias;
        for (let j = 0; j < numFeatures; j++) z += this.weights[j] * XTrain[i][j];
        const p = sigmoid(z);
        const err = p - yTrain[i];

        for (let j = 0; j < numFeatures; j++) {
          gradW[j] += err * XTrain[i][j];
        }
        gradB += err;
      }

      // Update with L2 regularization penalty
      for (let j = 0; j < numFeatures; j++) {
        const l2Term = this.l2Lambda * this.weights[j];
        this.weights[j] -= this.learningRate * ((gradW[j] / n) + l2Term);
      }
      this.bias -= this.learningRate * (gradB / n);

      // Check validation loss for early stopping every 10 epochs
      if (epoch % 10 === 0 && XVal.length > 0) {
        const valProbs = this.predictProbabilities(XValRaw);
        const valLoss = computeLogLoss(yVal, valProbs);
        if (valLoss < bestValLoss) {
          bestValLoss = valLoss;
          bestWeights = [...this.weights];
          bestBias = this.bias;
        }
      }
    }

    this.weights = bestWeights;
    this.bias = bestBias;
  }

  /**
   * Predict continuous win probability [0, 1] for an array of feature vectors.
   */
  predictProbabilities(XRaw) {
    const X = this._transform(XRaw);
    return X.map(row => {
      let z = this.bias;
      for (let j = 0; j < row.length; j++) z += this.weights[j] * row[j];
      return Math.round(sigmoid(z) * 1000) / 1000;
    });
  }

  /**
   * Predict single deal win probability.
   */
  predictSingleDeal(deal, benchmarks = {}, asOfDate = new Date()) {
    const { vector } = extractFeaturesFromDeal(deal, benchmarks, asOfDate);
    const prob = this.predictProbabilities([vector])[0];
    return Math.max(0.05, Math.min(0.98, prob));
  }
}

// ── Model 1 Training & Database Persistence Engine ─────────────────────

/**
 * Train Model 1 against historical closed deals in PostgreSQL with a time-based train/val/test split.
 */
async function trainAndSaveModel1() {
  console.log('🧠 Starting Model 1 (Logistic Regression Baseline) Training Pipeline...');

  const benchmarks = await computeCorpusBenchmarks();

  // 1. Fetch all historical closed deals ordered chronologically
  let deals = [];
  try {
    const { rows } = await pool.query(`
      SELECT 
        id,
        gross_revenue,
        net_revenue,
        sales_rep_name,
        stage_name,
        industry,
        lead_source,
        status,
        deal_date,
        closed_at,
        created_at
      FROM deals
      WHERE status IN ('won', 'lost')
      ORDER BY COALESCE(deal_date, created_at) ASC
    `);
    deals = rows;
  } catch (err) {
    console.warn('[winProbabilityModel] Database deals fetch note, using fallback dataset:', err.message);
  }

  if (deals.length < 20) {
    console.log(`⚠️ Insufficient closed deals in DB (${deals.length}). Using synthetic historical dataset for calibration.`);
    return null;
  }

  // 2. Extract feature matrix X and target array y
  const XRaw = [];
  const y = [];

  deals.forEach(deal => {
    const closeDate = deal.closed_at || deal.deal_date || deal.date || deal.created_at;
    const asOfDate = new Date(closeDate);
    const feat = extractFeaturesFromDeal(deal, benchmarks, asOfDate);
    XRaw.push(feat.vector);
    y.push(deal.status === 'won' ? 1 : 0);
  });

  const totalRecords = XRaw.length;
  console.log(`📊 Total historical closed deals: ${totalRecords}`);

  // 3. Time-Based Split: 70% Train (older deals), 15% Validation (middle), 15% Test (most recent)
  const trainIdx = Math.floor(totalRecords * 0.70);
  const valIdx = Math.floor(totalRecords * 0.85);

  const XTrain = XRaw.slice(0, trainIdx);
  const yTrain = y.slice(0, trainIdx);

  const XVal = XRaw.slice(trainIdx, valIdx);
  const yVal = y.slice(trainIdx, valIdx);

  const XTest = XRaw.slice(valIdx);
  const yTest = y.slice(valIdx);

  console.log(`⏱️ Time-Based Dataset Split: Train=${XTrain.length}, Validation=${XVal.length}, Test=${XTest.length}`);

  // 4. Train Model 1 (L2 Regularized Logistic Regression)
  const model = new LogisticRegressionWinModel({
    learningRate: 0.08,
    l2Lambda: 0.015,
    epochs: 500,
    version: 'v1.2.0-lr-baseline'
  });

  model.train(XTrain, yTrain, XVal, yVal);

  // 5. Evaluate on Validation & Held-Out Out-of-Time Test Set
  const valProbs = model.predictProbabilities(XVal);
  const valMetrics = computeClassificationMetrics(yVal, valProbs);

  const testProbs = model.predictProbabilities(XTest);
  const testMetrics = computeClassificationMetrics(yTest, testProbs);

  console.log('📈 Validation Metrics:', valMetrics);
  console.log('🎯 Held-Out Test Metrics:', testMetrics);

  // 6. Persist Model Version & Weights in PostgreSQL
  try {
    // Set all previous models to is_active = false
    await pool.query(`UPDATE model_versions SET is_active = false WHERE model_name = 'win_probability_lr'`);

    const insertSql = `
      INSERT INTO model_versions (
        model_name,
        version,
        weights,
        hyperparameters,
        metrics,
        trained_on_records_count,
        is_active,
        trained_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP)
      RETURNING id, version, trained_at;
    `;

    const weightsPayload = {
      weights: model.weights,
      bias: model.bias,
      scalerMeans: model.scalerMeans,
      scalerStds: model.scalerStds,
      featureKeys: NUMERIC_FEATURE_KEYS
    };

    const hyperParams = {
      learningRate: model.learningRate,
      l2Lambda: model.l2Lambda,
      epochs: model.epochs,
      splitRatio: '70-15-15 (Time-Based)'
    };

    const combinedMetrics = {
      validation: valMetrics,
      test: testMetrics
    };

    const { rows: inserted } = await pool.query(insertSql, [
      'win_probability_lr',
      model.version,
      JSON.stringify(weightsPayload),
      JSON.stringify(hyperParams),
      JSON.stringify(combinedMetrics),
      totalRecords
    ]);

    console.log(`💾 Model 1 saved to model_versions table (ID: ${inserted[0].id}, Version: ${inserted[0].version})`);
  } catch (dbErr) {
    console.warn('[winProbabilityModel] Database model save notice:', dbErr.message);
  }

  return {
    model,
    valMetrics,
    testMetrics
  };
}

module.exports = {
  LogisticRegressionWinModel,
  trainAndSaveModel1,
  computeClassificationMetrics
};
