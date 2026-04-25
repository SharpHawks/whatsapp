-- Add recipient_type column to messages table
-- This allows distinguishing between contact and group messages

ALTER TABLE messages 
ADD COLUMN recipient_type VARCHAR(10) DEFAULT 'contact' CHECK (recipient_type IN ('contact', 'group'));

-- Set default value for existing records
UPDATE messages SET recipient_type = 'contact' WHERE recipient_type IS NULL;

-- Create index for recipient_type for better query performance
CREATE INDEX idx_messages_recipient_type ON messages(recipient_type);

-- Add comment to document the column
COMMENT ON COLUMN messages.recipient_type IS 'Type of recipient: contact (phone number) or group (group ID)';
