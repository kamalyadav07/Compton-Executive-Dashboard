-- =====================================================================
-- Migration: 009_model_monitoring.sql
-- Description: Creates model_monitoring_runs table for persistent tracking
--              of out-of-sample metrics, feature drift, and proactive alerts.
-- =====================================================================

CREATE TABLE IF NOT EXISTS model_monitoring_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_version VARCHAR(50) NOT NULL DEFAULT 'v1.2.0-lr-baseline',
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    window_days INTEGER NOT NULL DEFAULT 30,
    resolved_predictions_count INTEGER NOT NULL DEFAULT 0,
    accuracy NUMERIC(5, 4),
    roc_auc NUMERIC(5, 4),
    brier_score NUMERIC(7, 5),
    expected_calibration_error NUMERIC(5, 4),
    log_loss NUMERIC(7, 5),
    feature_drift JSONB NOT NULL DEFAULT '[]'::jsonb,
    prediction_drift JSONB NOT NULL DEFAULT '{}'::jsonb,
    win_rate_drift JSONB NOT NULL DEFAULT '{}'::jsonb,
    revenue_drift JSONB NOT NULL DEFAULT '{}'::jsonb,
    alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'HEALTHY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_model_monitoring_runs_date ON model_monitoring_runs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_model_monitoring_runs_status ON model_monitoring_runs(status);
