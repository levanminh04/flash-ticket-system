-- ============================================================================
-- V6__init_discovery_schema.sql
-- Discovery Service — Chat + RAG tables
-- ============================================================================
-- NOTE: ai_schema giữ nguyên (legacy). discovery_schema là schema mới
--       cho discovery-service (refactored từ ai-service).
--
-- REVIEW CHECKLIST trước khi chạy:
--   1. Backup DB nếu cần (pg_dump)
--   2. Confirm ai_schema không có dữ liệu quan trọng
--   3. Chạy trên đúng database: flash-ticket
-- ============================================================================

-- Step 1: Tạo schema mới
CREATE SCHEMA IF NOT EXISTS discovery_schema;

-- Step 2: Bảng chat_sessions
CREATE TABLE IF NOT EXISTS discovery_schema.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    mood VARCHAR(20) DEFAULT 'NEUTRAL',
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user 
    ON discovery_schema.chat_sessions(user_id);

-- Step 3: Bảng chat_messages  
CREATE TABLE IF NOT EXISTS discovery_schema.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES discovery_schema.chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    tool_name VARCHAR(100),
    tool_result TEXT,
    mood VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_chat_message_role CHECK (role IN ('USER', 'AI', 'SYSTEM', 'TOOL'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session 
    ON discovery_schema.chat_messages(session_id);

-- Step 4: Auto-update trigger cho updated_at
CREATE TRIGGER update_updated_at 
    BEFORE UPDATE ON discovery_schema.chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Verify
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema = 'discovery_schema'
ORDER BY table_name;

-- NOTE: discovery_schema.event_embeddings sẽ được LangChain4j 
-- PgVectorEmbeddingStore tự tạo khi discovery-service khởi động.
-- Không cần tạo thủ công.
-- ============================================================================
