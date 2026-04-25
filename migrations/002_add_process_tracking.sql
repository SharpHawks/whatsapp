-- Add process tracking columns to bots table
ALTER TABLE bots 
  ADD COLUMN connection_process_id INTEGER,
  ADD COLUMN connection_hostname VARCHAR(255),
  ADD COLUMN connection_updated_at TIMESTAMP;

-- Create index on connection_status and connection_updated_at for monitoring queries
CREATE INDEX idx_bots_connection_monitoring ON bots(connection_status, connection_updated_at);

-- Add comment to document the purpose of these columns
COMMENT ON COLUMN bots.connection_process_id IS 'Process ID of the worker or server managing this bot connection';
COMMENT ON COLUMN bots.connection_hostname IS 'Hostname of the machine where the connection is managed';
COMMENT ON COLUMN bots.connection_updated_at IS 'Last time the connection status was updated';
