-- Add connection tracking fields to bots table
ALTER TABLE bots ADD COLUMN IF NOT EXISTS connection_process_id INTEGER;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS connection_hostname VARCHAR(255);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS connection_updated_at TIMESTAMP;

-- Add indexes for connection tracking
CREATE INDEX IF NOT EXISTS idx_bots_connection_process ON bots(connection_process_id);
CREATE INDEX IF NOT EXISTS idx_bots_connection_hostname ON bots(connection_hostname);
