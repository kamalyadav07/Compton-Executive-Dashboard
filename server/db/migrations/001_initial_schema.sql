-- =====================================================================
-- Migration: 001_initial_schema.sql
-- Description: Core Schema for Compton Executive Dashboard
-- Extensions: uuid-ossp, pgvector, pg_trgm
-- =====================================================================

-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Utility Trigger Function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 3. Identity & Master Dimension Tables
-- =====================================================================

-- Table: users (System users, role-based access control)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'executive', 'sales_rep', 'viewer')),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Table: sales_reps (Bitrix CRM sales team dimension)
CREATE TABLE IF NOT EXISTS sales_reps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bitrix_user_id VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    avatar_url TEXT,
    monthly_target NUMERIC(15, 2) NOT NULL DEFAULT 550000.00,
    yearly_target NUMERIC(15, 2) NOT NULL DEFAULT 6600000.00,
    is_active_for_leaderboard BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_reps_name ON sales_reps(name);
CREATE INDEX IF NOT EXISTS idx_sales_reps_bitrix_id ON sales_reps(bitrix_user_id);

-- Table: customers (Customer accounts and entities)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100) DEFAULT 'General Industry',
    company_type VARCHAR(100),
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_normalized_name ON customers(normalized_name);

-- =====================================================================
-- 4. Deals, Products, and Stage History
-- =====================================================================

-- Table: deals (Core CRM deal records mapped from DealRecord & raw Bitrix fields)
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bitrix_deal_id VARCHAR(100) UNIQUE NOT NULL,
    title TEXT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    sales_rep_id UUID REFERENCES sales_reps(id) ON DELETE SET NULL,
    sales_rep_name VARCHAR(255) NOT NULL,
    stage_id VARCHAR(100),
    stage_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('won', 'lost', 'in_progress')),
    gross_revenue NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    net_revenue NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    gst_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    margin NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    margin_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    industry VARCHAR(100) NOT NULL DEFAULT 'General Industry',
    lead_source VARCHAR(100) NOT NULL DEFAULT 'Direct Inquiry',
    solution TEXT NOT NULL DEFAULT 'Enterprise Solutions',
    deal_date DATE,
    month_year VARCHAR(50),
    year INTEGER,
    quarter VARCHAR(50),
    contract_term_months INTEGER DEFAULT 12,
    win_probability NUMERIC(5, 2) DEFAULT 50.00,
    sales_cycle_days INTEGER DEFAULT 14,
    lost_reason TEXT,
    winning_competitor VARCHAR(255),
    comments TEXT,
    remarks TEXT,
    file_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_record JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deals_bitrix_id ON deals(bitrix_deal_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_sales_rep_id ON deals(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_deals_customer_id ON deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_deals_deal_date ON deals(deal_date);
CREATE INDEX IF NOT EXISTS idx_deals_month_year ON deals(month_year);
CREATE INDEX IF NOT EXISTS idx_deals_stage_name ON deals(stage_name);
CREATE INDEX IF NOT EXISTS idx_deals_industry ON deals(industry);
CREATE INDEX IF NOT EXISTS idx_deals_customer_trgm ON deals USING gin(customer_name gin_trgm_ops);

-- Table: deal_products (Quoted line items & products per deal)
CREATE TABLE IF NOT EXISTS deal_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deal_products_deal_id ON deal_products(deal_id);

-- Table: deal_stage_history (Stage transitions and duration tracking)
CREATE TABLE IF NOT EXISTS deal_stage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    stage VARCHAR(100) NOT NULL,
    entered_at TIMESTAMPTZ NOT NULL,
    exited_at TIMESTAMPTZ,
    duration_days NUMERIC(8, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deal_stage_history_deal_id ON deal_stage_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_stage ON deal_stage_history(stage);

-- Table: activities (CRM timeline notes, comments, calls, and actions)
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL DEFAULT 'comment' CHECK (activity_type IN ('comment', 'call', 'meeting', 'task', 'email', 'system')),
    author VARCHAR(255),
    content TEXT NOT NULL,
    activity_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_date);

-- =====================================================================
-- 5. Projects & Project Delivery Tasks (Google Sheets Ingest)
-- =====================================================================

-- Table: projects (Project delivery records)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_project_id VARCHAR(100) UNIQUE NOT NULL,
    s_no VARCHAR(50),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Running' CHECK (status IN ('Running', 'Completed', 'Delayed', 'On Hold', 'Planning')),
    project_type VARCHAR(100) NOT NULL DEFAULT 'General',
    start_date DATE,
    planned_end_date DATE,
    actual_end_date DATE,
    planned_budget NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    actual_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    timeline_status VARCHAR(50) NOT NULL DEFAULT 'On Time' CHECK (timeline_status IN ('On Time', 'Delayed')),
    budget_status VARCHAR(50) NOT NULL DEFAULT 'On Budget' CHECK (budget_status IN ('Under Budget', 'On Budget', 'Over Budget')),
    budget_variance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    budget_variance_pct NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    delay_days INTEGER NOT NULL DEFAULT 0,
    raw_record JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);

-- Table: project_tasks (Subtasks and milestone deliverables)
CREATE TABLE IF NOT EXISTS project_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    assigned_to VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Blocked')),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);

-- =====================================================================
-- 6. Documents & pgvector Vector Store
-- =====================================================================

-- Table: documents (Bitrix attached quotations, PDFs, specifications)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    file_id VARCHAR(100),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) DEFAULT 'pdf',
    file_size_bytes BIGINT,
    download_url TEXT,
    extracted_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_deal_id ON documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_documents_file_id ON documents(file_id);

-- Table: document_chunks (Vector embeddings & semantic search chunks)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    tfidf_vector JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_chunks_doc_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_deal_id ON document_chunks(deal_id);

-- HNSW Vector Index for High-Speed Cosine Similarity Search
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding_hnsw 
ON document_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- =====================================================================
-- 7. Machine Learning, Predictions & Calibration
-- =====================================================================

-- Table: model_versions (Trained model weights and metadata)
CREATE TABLE IF NOT EXISTS model_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    weights JSONB NOT NULL,
    hyperparameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    trained_on_records_count INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    trained_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_model_versions_active ON model_versions(model_name, is_active);

-- Table: predictions (Daily prediction snapshots and outcome reconciliations)
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    model_version_id UUID REFERENCES model_versions(id) ON DELETE SET NULL,
    predicted_win_probability NUMERIC(5, 2) NOT NULL,
    probability_7d NUMERIC(5, 2),
    probability_15d NUMERIC(5, 2),
    probability_30d NUMERIC(5, 2),
    expected_value NUMERIC(15, 2),
    risk_score NUMERIC(5, 2),
    risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    qualitative_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    actual_outcome VARCHAR(50) CHECK (actual_outcome IN ('won', 'lost', NULL)),
    reconciled_at TIMESTAMPTZ,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_predictions_deal_id ON predictions(deal_id);
CREATE INDEX IF NOT EXISTS idx_predictions_snapshot_date ON predictions(snapshot_date);

-- Table: features (Extracted training feature vectors per deal)
CREATE TABLE IF NOT EXISTS features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL,
    feature_value NUMERIC(15, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_features_deal_id ON features(deal_id);
CREATE INDEX IF NOT EXISTS idx_features_key ON features(feature_key);

-- =====================================================================
-- 8. Synchronization Runs & Dead Letter Queue Errors
-- =====================================================================

-- Table: sync_runs (Audit log of Bitrix and Sheets ingestion jobs)
CREATE TABLE IF NOT EXISTS sync_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(50) NOT NULL CHECK (source IN ('bitrix24', 'google_sheets_projects', 'google_sheets_orders')),
    status VARCHAR(50) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error', 'partial')),
    records_fetched INTEGER NOT NULL DEFAULT 0,
    records_inserted INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_source ON sync_runs(source, started_at DESC);

-- Table: sync_errors (DLQ service for failed records and sync faults)
CREATE TABLE IF NOT EXISTS sync_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_run_id UUID REFERENCES sync_runs(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL,
    error_type VARCHAR(100),
    error_message TEXT NOT NULL,
    payload JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_errors_occurred ON sync_errors(occurred_at DESC);

-- =====================================================================
-- 9. AI Chatbot Sessions & Message History
-- =====================================================================

-- Table: chat_sessions (Conversational memory containers)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(100) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: chat_messages (Individual query and response entries)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tools_invoked JSONB NOT NULL DEFAULT '[]'::jsonb,
    token_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at ASC);

-- =====================================================================
-- 10. Triggers for updated_at Management
-- =====================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_users_updated_at') THEN
        CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_sales_reps_updated_at') THEN
        CREATE TRIGGER set_sales_reps_updated_at BEFORE UPDATE ON sales_reps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_customers_updated_at') THEN
        CREATE TRIGGER set_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_deals_updated_at') THEN
        CREATE TRIGGER set_deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_projects_updated_at') THEN
        CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_chat_sessions_updated_at') THEN
        CREATE TRIGGER set_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
