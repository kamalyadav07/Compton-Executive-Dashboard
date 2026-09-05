-- =====================================================================
-- Migration: 007_features_and_ml_tables.sql
-- Description: Enriched feature store schema and ML training views
-- =====================================================================

-- 1. Wide Feature Store Table for Fast Training & Inference Lookups
CREATE TABLE IF NOT EXISTS deal_features_store (
    deal_id UUID PRIMARY KEY REFERENCES deals(id) ON DELETE CASCADE,
    deal_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    stage VARCHAR(100),
    stage_progress NUMERIC(5, 4) NOT NULL DEFAULT 0.3,
    stage_age_days INTEGER NOT NULL DEFAULT 0,
    total_deal_age_days INTEGER NOT NULL DEFAULT 0,
    sales_rep VARCHAR(100),
    rep_win_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.5,
    industry VARCHAR(100),
    industry_win_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.5,
    lead_source VARCHAR(100),
    source_win_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.5,
    customer_lifetime_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    customer_deal_count INTEGER NOT NULL DEFAULT 1,
    previous_wins INTEGER NOT NULL DEFAULT 0,
    previous_losses INTEGER NOT NULL DEFAULT 0,
    activity_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    days_since_activity INTEGER NOT NULL DEFAULT 0,
    proposal_revisions INTEGER NOT NULL DEFAULT 1,
    discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
    margin_pct NUMERIC(5, 2) NOT NULL DEFAULT 20,
    quarter VARCHAR(10),
    month_num INTEGER NOT NULL DEFAULT 1,
    is_won BOOLEAN,
    closed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deal_features_store_closed ON deal_features_store(closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_features_store_is_won ON deal_features_store(is_won) WHERE is_won IS NOT NULL;
