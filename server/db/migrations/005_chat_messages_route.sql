-- =====================================================================
-- Migration: 005_chat_messages_route.sql
-- Description: Adds route column to chat_messages for RAG intent routing audit
-- =====================================================================

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS route VARCHAR(50) DEFAULT 'STRUCTURED_DATA';
CREATE INDEX IF NOT EXISTS idx_chat_messages_route ON chat_messages(route, created_at DESC);
