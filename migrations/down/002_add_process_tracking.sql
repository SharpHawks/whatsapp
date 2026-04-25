-- Rollback: Remove process tracking columns from bots table

-- Drop the monitoring index
DROP INDEX IF EXISTS idx_bots_connection_monitoring;

-- Remove the columns
ALTER TABLE bots 
  DROP COLUMN IF EXISTS connection_process_id,
  DROP COLUMN IF EXISTS connection_hostname,
  DROP COLUMN IF EXISTS connection_updated_at;
