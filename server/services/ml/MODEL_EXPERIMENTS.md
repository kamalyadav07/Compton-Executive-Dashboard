# Win Probability Model Architecture & Experimentation Plan

This document establishes the experimental protocol, benchmark metrics, and Go/No-Go criteria for evaluating higher-complexity machine learning models against **Model 1 (Logistic Regression Baseline)** for Compton's deal win probability estimation.

---

## 1. Dataset & Volume Constraints

- **Historical Closed Deals:** ~1,200 deals (`status IN ('won', 'lost')`)
- **Dataset Partitioning Protocol:** Strict **Time-Based Chronological Split**:
  - **Training Set (70%):** Oldest closed deals (used for feature scaling and parameter optimization).
  - **Validation Set (15%):** Intermediate closed deals (used for early stopping, regularization tuning, and threshold calibration).
  - **Held-Out Test Set (15%):** Most recent out-of-time closed deals (used strictly for final unbiased evaluation).

---

## 2. Model 1: Baseline Architecture

- **Algorithm:** L2-Regularized Logistic Regression with StandardScaler normalization.
- **Feature Set:** 22 CRM, historical, and behavioral features (`deal_features_store`).
- **Inference Runtime:** Node.js native (`< 1ms` latency, zero external sidecars).
- **Versioning:** Stored in `model_versions` table with weights, bias, feature means/stds, and metrics JSON.

---

## 3. Candidate Models Evaluation (Model 2 / 3 / 4)

Candidate models for future evaluation on the held-out test split:
- **Model 2: LightGBM** (Gradient Boosted Decision Trees with histogram binning)
- **Model 3: XGBoost** (Exact greedy tree boosting with sparsity awareness)
- **Model 4: CatBoost** (Ordered boosting with native categorical encoding)

---

## 4. Time-Boxed Go / No-Go Decision Criteria

Given the current dataset volume (~1,200 records), tree-based gradient boosting models risk overfitting small tabular datasets while adding architectural complexity (Python sidecar or ONNX runtime).

### Go / No-Go Thresholds:

| Metric | Model 1 (Baseline LR) | Candidate Model Target | Go / No-Go Threshold |
| :--- | :--- | :--- | :--- |
| **Out-of-Time Test ROC-AUC** | ~0.80 – 0.83 | $\ge 0.87$ | **Adopt ONLY if $\Delta \text{AUC} \ge +0.05$** |
| **Brier Score (Calibration)** | $\le 0.16$ | $\le 0.16$ | **Must NOT regress by $> 0.02$** |
| **LogLoss** | $\le 0.48$ | $\le 0.42$ | **Must show statistically significant reduction** |
| **Infrastructure Overhead** | Zero (Native JS) | ONNX Runtime / Microservice | **Justified ONLY if AUC threshold is met** |

> [!IMPORTANT]
> **Decision Rule:**
> If a candidate model does not achieve a **$\ge 0.05$ AUC improvement** on the held-out out-of-time test set, **Model 1 remains the production standard**. Complexity is rejected until dataset volume doubles ($\ge 2,500$ closed deals).
