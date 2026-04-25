-- Migration: Increase field lengths in messages table to support group IDs
-- Group IDs in WhatsApp can be longer than 20 characters (e.g., 120363123456789012@g.us)

-- Increase from_number and to_number to support group IDs
ALTER TABLE messages 
  ALTER COLUMN from_number TYPE VARCHAR(100),
  ALTER COLUMN to_number TYPE VARCHAR(100),
  ALTER COLUMN type TYPE VARCHAR(50);

-- Add comment for clarity
COMMENT ON COLUMN messages.from_number IS 'Phone number or group ID (e.g., +1234567890 or 120363123456789012@g.us)';
COMMENT ON COLUMN messages.to_number IS 'Phone number or group ID (e.g., +1234567890 or 120363123456789012@g.us)';
