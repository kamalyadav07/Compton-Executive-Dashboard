/**
 * server/services/ml/calibrationEngine.js
 * -----------------------------------------------------------------------
 * Win-Probability Calibration Measurement & Correction Engine.
 *
 * Implements:
 *   1. Metrics: ECE (Expected Calibration Error), MCE (Max Calibration Error),
 *      Brier Score, LogLoss, ROC-AUC, PR-AUC.
 *   2. Decile Reliability Curve generation: [0-10%], [10-20%], ..., [90-100%].
 *   3. Post-Processing Calibrators: Platt Scaling & Isotonic Regression (PAVA).
 *   4. Prediction Persistence & Closed Deal Outcome Reconciliation in PostgreSQL.
 */

const { pool } = require('../../db');

// ── Math & Metrics Helpers ──────────────────────────────────────────────

function logit(p) {
  const eps = 1e-6;
  const clamped = Math.max(eps, Math.min(1 - eps, p));
  return Math.log(clamped / (1 - clamped));
}

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
  return loss / (yTrue.length || 1);
}

function computeBrierScore(yTrue, yProb) {
  let sumSq = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const diff = yProb[i] - yTrue[i];
    sumSq += diff * diff;
  }
  return sumSq / (yTrue.length || 1);
}

function computeRocAuc(yTrue, yProb) {
  const pairs = yTrue.map((yt, i) => ({ y: yt, p: yProb[i] }));
  pairs.sort((a, b) => b.p - a.p);

  let nPos = 0, nNeg = 0;
  pairs.forEach(p => {
    if (p.y === 1) nPos++;
    else nNeg++;
  });

  if (nPos === 0 || nNeg === 0) return 0.5;

  let sumRankPos = 0;
  for (let i = 0; i < pairs.length; i++) {
    const rank = pairs.length - i;
    if (pairs[i].y === 1) sumRankPos += rank;
  }

  const u = sumRankPos - (nPos * (nPos + 1)) / 2;
  return Math.round((u / (nPos * nNeg)) * 10000) / 10000;
}

function computePrAuc(yTrue, yProb) {
  const pairs = yTrue.map((yt, i) => ({ y: yt, p: yProb[i] }));
  pairs.sort((a, b) => b.p - a.p);

  let tp = 0, fp = 0;
  let prevRecall = 0;
  let prAuc = 0;
  const totalPos = pairs.filter(p => p.y === 1).length;
  if (totalPos === 0) return 0;

  pairs.forEach(p => {
    if (p.y === 1) tp++;
    else fp++;
    const recall = tp / totalPos;
    const precision = tp / (tp + fp);
    prAuc += (recall - prevRecall) * precision;
    prevRecall = recall;
  });

  return Math.round(prAuc * 10000) / 10000;
}

// ── Decile Reliability Curve & Calibration Errors ───────────────────────

/**
 * Computes 10-bin decile reliability curve, ECE, and MCE.
 */
function computeCalibrationCurve(yTrue, yProb, numBins = 10) {
  const bins = [];
  for (let b = 0; b < numBins; b++) {
    bins.push({
      binIndex: b,
      binRange: `${b * 10}-${(b + 1) * 10}%`,
      minProb: b / numBins,
      maxProb: (b + 1) / numBins,
      count: 0,
      predictedSum: 0,
      actualWonCount: 0
    });
  }

  const N = yTrue.length;
  for (let i = 0; i < N; i++) {
    const p = Math.max(0, Math.min(0.9999, yProb[i]));
    const binIdx = Math.min(numBins - 1, Math.floor(p * numBins));
    bins[binIdx].count++;
    bins[binIdx].predictedSum += p;
    if (yTrue[i] === 1) bins[binIdx].actualWonCount++;
  }

  let ece = 0;
  let mce = 0;

  const deciles = bins.map(b => {
    const meanPred = b.count > 0 ? b.predictedSum / b.count : (b.minProb + b.maxProb) / 2;
    const actualWinRate = b.count > 0 ? b.actualWonCount / b.count : 0;
    const error = b.count > 0 ? Math.abs(meanPred - actualWinRate) : 0;

    if (b.count > 0) {
      ece += (b.count / N) * error;
      if (error > mce) mce = error;
    }

    return {
      binRange: b.binRange,
      count: b.count,
      meanPredictedPct: Math.round(meanPred * 1000) / 10,
      actualWinRatePct: Math.round(actualWinRate * 1000) / 10,
      calibrationGapPct: Math.round(error * 1000) / 10,
      isWellCalibrated: error <= 0.08
    };
  });

  return {
    deciles,
    expectedCalibrationError: Math.round(ece * 10000) / 10000,
    maxCalibrationError: Math.round(mce * 10000) / 10000,
    sampleSize: N,
    brierScore: Math.round(computeBrierScore(yTrue, yProb) * 10000) / 10000,
    logLoss: Math.round(computeLogLoss(yTrue, yProb) * 10000) / 10000,
    rocAuc: computeRocAuc(yTrue, yProb),
    prAuc: computePrAuc(yTrue, yProb)
  };
}

// ── Post-Processing Calibrators ─────────────────────────────────────────

/**
 * Platt Scaling: Fits logistic regression over logit(prob) to minimize NLL.
 * P_calibrated = sigmoid(A * logit(p) + B)
 */
class PlattCalibrator {
  constructor() {
    this.A = 1.0;
    this.B = 0.0;
    this.method = 'platt_scaling';
  }

  fit(yTrue, yProb, epochs = 250, lr = 0.05) {
    const N = yTrue.length;
    if (N === 0) return;

    const logits = yProb.map(p => logit(p));
    let a = 1.0;
    let b = 0.0;

    for (let ep = 0; ep < epochs; ep++) {
      let gradA = 0;
      let gradB = 0;
      for (let i = 0; i < N; i++) {
        const z = a * logits[i] + b;
        const pCal = sigmoid(z);
        const err = pCal - yTrue[i];
        gradA += err * logits[i];
        gradB += err;
      }
      a -= lr * (gradA / N);
      b -= lr * (gradB / N);
    }

    this.A = Math.round(a * 10000) / 10000;
    this.B = Math.round(b * 10000) / 10000;
  }

  transform(prob) {
    const z = this.A * logit(prob) + this.B;
    return Math.round(sigmoid(z) * 1000) / 1000;
  }

  transformArray(probs) {
    return probs.map(p => this.transform(p));
  }
}

/**
 * Isotonic Regression Calibrator (Pool Adjacent Violators Algorithm - PAVA).
 */
class IsotonicCalibrator {
  constructor() {
    this.knots = [];
    this.method = 'isotonic_regression';
  }

  fit(yTrue, yProb) {
    const pairs = yProb.map((p, i) => ({ p, y: yTrue[i], weight: 1 }));
    pairs.sort((a, b) => a.p - b.p);

    // PAVA algorithm
    const blocks = pairs.map(item => ({
      p: item.p,
      y: item.y,
      weight: 1
    }));

    let i = 0;
    while (i < blocks.length - 1) {
      if (blocks[i].y > blocks[i + 1].y) {
        // Pool violators
        const totalW = blocks[i].weight + blocks[i + 1].weight;
        const pooledY = (blocks[i].y * blocks[i].weight + blocks[i + 1].y * blocks[i + 1].weight) / totalW;
        blocks[i] = {
          p: (blocks[i].p + blocks[i + 1].p) / 2,
          y: pooledY,
          weight: totalW
        };
        blocks.splice(i + 1, 1);
        if (i > 0) i--; // Backtrack
      } else {
        i++;
      }
    }

    this.knots = blocks.map(b => ({ p: b.p, yCal: Math.round(b.y * 1000) / 1000 }));
  }

  transform(prob) {
    if (this.knots.length === 0) return prob;
    if (prob <= this.knots[0].p) return this.knots[0].yCal;
    if (prob >= this.knots[this.knots.length - 1].p) return this.knots[this.knots.length - 1].yCal;

    // Linear interpolation between nearest knots
    for (let i = 0; i < this.knots.length - 1; i++) {
      if (prob >= this.knots[i].p && prob <= this.knots[i + 1].p) {
        const span = this.knots[i + 1].p - this.knots[i].p;
        const t = span > 0 ? (prob - this.knots[i].p) / span : 0;
        const val = this.knots[i].yCal + t * (this.knots[i + 1].yCal - this.knots[i].yCal);
        return Math.round(val * 1000) / 1000;
      }
    }
    return prob;
  }

  transformArray(probs) {
    return probs.map(p => this.transform(p));
  }
}

// ── Database Ingestion & Reconciliation Helpers ─────────────────────────

/**
 * Record a deal prediction into PostgreSQL `predictions` table.
 */
async function recordDealPrediction({
  dealId,
  modelVersionId = null,
  rawProbability,
  calibratedProbability,
  probability7d = null,
  probability30d = null,
  featuresVersion = 'v1',
  calibrationMethod = 'platt_scaling'
}) {
  try {
    await pool.query(`
      INSERT INTO predictions (
        deal_id, model_version_id, predicted_win_probability,
        raw_probability, calibrated_probability, probability_7d, probability_30d,
        features_version, calibration_method, snapshot_date, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE, CURRENT_TIMESTAMP
      )
    `, [
      dealId,
      modelVersionId,
      calibratedProbability !== undefined ? calibratedProbability * 100 : rawProbability * 100,
      rawProbability,
      calibratedProbability,
      probability7d,
      probability30d,
      featuresVersion,
      calibrationMethod
    ]);
  } catch (err) {
    console.warn(`[calibrationEngine] Record prediction notice for deal ${dealId}:`, err.message);
  }
}

/**
 * Reconcile predictions against newly closed deals in PostgreSQL.
 */
async function reconcilePredictionOutcomes() {
  try {
    const result = await pool.query(`
      UPDATE predictions p
      SET 
        actual_outcome = d.status,
        reconciled_at = CURRENT_TIMESTAMP
      FROM deals d
      WHERE p.deal_id = d.id
        AND d.status IN ('won', 'lost')
        AND p.actual_outcome IS NULL
    `);
    return result.rowCount || 0;
  } catch (err) {
    console.warn('[calibrationEngine] Outcome reconciliation notice:', err.message);
    return 0;
  }
}

module.exports = {
  computeCalibrationCurve,
  PlattCalibrator,
  IsotonicCalibrator,
  recordDealPrediction,
  reconcilePredictionOutcomes,
  computeBrierScore,
  computeLogLoss,
  computeRocAuc,
  computePrAuc
};
