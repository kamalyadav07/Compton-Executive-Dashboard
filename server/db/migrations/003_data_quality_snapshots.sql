-- =====================================================================
-- Migration: 003_data_quality_snapshots.sql
-- Description: Creates data_quality_snapshots table for 6D DQI tracking
-- =====================================================================

CREATE TABLE IF NOT EXISTS data_quality_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_run_id UUID REFERENCES sync_runs(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL DEFAULT 'deal' CHECK (entity_type IN ('deal', 'customer', 'project', 'all')),
    total_records_evaluated INTEGER NOT NULL DEFAULT 0,
    passed_records_count INTEGER NOT NULL DEFAULT 0,
    failed_records_count INTEGER NOT NULL DEFAULT 0,
    overall_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    completeness_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    uniqueness_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    validity_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    consistency_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    integrity_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    freshness_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    metrics_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dq_snapshots_created ON data_quality_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dq_snapshots_entity ON data_quality_snapshots(entity_type, created_at DESC);
