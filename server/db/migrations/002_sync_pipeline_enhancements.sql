-- =====================================================================
-- Migration: 002_sync_pipeline_enhancements.sql
-- Description: Enhances sync_runs and adds sync_configs table
-- =====================================================================

-- 1. Enhance sync_runs table with records_failed and error columns
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS records_failed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS error TEXT;

-- 2. Create sync_configs table for persistent sync timestamps and cursors
CREATE TABLE IF NOT EXISTS sync_configs (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for sync_configs updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_sync_configs_updated_at') THEN
        CREATE TRIGGER set_sync_configs_updated_at BEFORE UPDATE ON sync_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
