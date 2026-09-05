-- =====================================================================
-- Migration: 004_fts_and_tfidf_indexes.sql
-- Description: GIN Indexes for Full-Text Search and TF-IDF Sparse Vectors
-- =====================================================================

-- 1. Full-Text Search GIN Indexes (both 'simple' for exact SKUs/codes and 'english' for prose)
CREATE INDEX IF NOT EXISTS idx_doc_chunks_tsv_simple 
ON document_chunks USING gin(to_tsvector('simple', content));

CREATE INDEX IF NOT EXISTS idx_doc_chunks_tsv_english 
ON document_chunks USING gin(to_tsvector('english', content));

-- 2. JSONB GIN Index for Sparse TF-IDF Vector term lookups
CREATE INDEX IF NOT EXISTS idx_doc_chunks_tfidf_jsonb 
ON document_chunks USING gin(tfidf_vector jsonb_path_ops);
