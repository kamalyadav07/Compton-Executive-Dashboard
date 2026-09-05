-- =====================================================================
-- Migration: 008_predictions_and_calibration.sql
-- Description: Adds raw/calibrated probability tracking to predictions table
--              and creates calibration_reports history table.
-- =====================================================================

-- 1. Enhance predictions table
ALTER TABLE predictions 
  ADD COLUMN IF NOT EXISTS raw_probability NUMERIC(5, 4),
  ADD COLUMN IF NOT EXISTS calibrated_probability NUMERIC(5, 4),
  ADD COLUMN IF NOT EXISTS features_version VARCHAR(50) DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS calibration_method VARCHAR(50) DEFAULT 'platt_scaling';

CREATE INDEX IF NOT EXISTS idx_predictions_reconciled ON predictions(actual_outcome) WHERE actual_outcome IS NOT NULL;

-- 2. Create calibration_reports table
CREATE TABLE IF NOT EXISTS calibration_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_version_id UUID REFERENCES model_versions(id) ON DELETE SET NULL,
    model_name VARCHAR(100) NOT NULL DEFAULT 'win_probability_lr',
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sample_size INTEGER NOT NULL,
    brier_score NUMERIC(7, 5) NOT NULL,
    log_loss NUMERIC(7, 5) NOT NULL,
    roc_auc NUMERIC(5, 4) NOT NULL,
    pr_auc NUMERIC(5, 4) NOT NULL,
    expected_calibration_error NUMERIC(5, 4) NOT NULL,
    max_calibration_error NUMERIC(5, 4) NOT NULL,
    deciles JSONB NOT NULL DEFAULT '[]'::jsonb,
    reliability_curve JSONB NOT NULL DEFAULT '[]'::jsonb,
    calibrator_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calibration_reports_date ON calibration_reports(report_date DESC);
