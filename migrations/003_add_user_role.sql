-- Add role column to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner'));

-- Add unlimited access flag for owners
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS unlimited_access BOOLEAN DEFAULT FALSE;

-- Set owner role for platform owner (unlimited access, no billing)
UPDATE users 
SET role = 'owner', unlimited_access = TRUE
WHERE email = 'indrikis38@gmail.com';

-- Add comments
COMMENT ON COLUMN users.role IS 'User role: user (regular customer), admin (elevated privileges), owner (platform owner with unlimited access)';
COMMENT ON COLUMN users.unlimited_access IS 'If true, user bypasses all quotas, rate limits, and billing checks';
