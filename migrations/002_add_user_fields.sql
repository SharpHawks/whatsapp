-- Add missing fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- Add index for role
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
