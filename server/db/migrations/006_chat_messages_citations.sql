-- =====================================================================
-- Migration: 006_chat_messages_citations.sql
-- Description: Adds source_type, source_reference, and citations columns
--              to chat_messages for hallucination defense & auditability.
-- =====================================================================

ALTER TABLE chat_messages 
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'structured',
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_chat_messages_source_type ON chat_messages(source_type);
