-- Add qr_generated_at column to bots table for tracking QR code generation time
ALTER TABLE bots 
  ADD COLUMN IF NOT EXISTS qr_generated_at TIMESTAMP;

-- Add index for faster QR lookups
CREATE INDEX IF NOT EXISTS idx_bots_qr_code ON bots(id) WHERE qr_code IS NOT NULL;
