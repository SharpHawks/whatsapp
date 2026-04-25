-- Rollback: Remove recipient_type column from messages table

-- Drop index
DROP INDEX IF EXISTS idx_messages_recipient_type;

-- Drop column
ALTER TABLE messages DROP COLUMN IF EXISTS recipient_type;
