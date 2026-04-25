-- Migration to update user_subscriptions table structure
-- This updates the old structure (with 'plan' VARCHAR) to the new structure (with 'plan_id' UUID)

-- Step 1: Add new columns
ALTER TABLE user_subscriptions 
  ADD COLUMN IF NOT EXISTS plan_id UUID,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP,
  ADD COLUMN IF NOT EXISTS messages_used INTEGER DEFAULT 0;

-- Step 2: Migrate data from old 'plan' column to new 'plan_id' column when upgrading older schemas.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_subscriptions'
      AND column_name = 'plan'
  ) THEN
    UPDATE user_subscriptions us
    SET plan_id = sp.id
    FROM subscription_plans sp
    WHERE LOWER(us.plan) = sp.slug;
  END IF;
END $$;

-- Step 3: Set default plan_id for any rows that didn't match
UPDATE user_subscriptions
SET plan_id = (SELECT id FROM subscription_plans WHERE slug = 'free' LIMIT 1)
WHERE plan_id IS NULL;

-- Step 4: Set current_period_start and current_period_end based on existing data.
-- Older schemas had started_at/expires_at; newer schemas from 004 already have period columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_subscriptions'
      AND column_name = 'started_at'
  ) THEN
    UPDATE user_subscriptions
    SET
      current_period_start = COALESCE(started_at, created_at, CURRENT_TIMESTAMP),
      current_period_end = COALESCE(expires_at, CURRENT_TIMESTAMP + INTERVAL '30 days')
    WHERE current_period_start IS NULL OR current_period_end IS NULL;
  ELSE
    UPDATE user_subscriptions
    SET
      current_period_start = COALESCE(current_period_start, created_at, CURRENT_TIMESTAMP),
      current_period_end = COALESCE(current_period_end, CURRENT_TIMESTAMP + INTERVAL '30 days')
    WHERE current_period_start IS NULL OR current_period_end IS NULL;
  END IF;
END $$;

-- Step 5: Make plan_id NOT NULL and add foreign key constraint
ALTER TABLE user_subscriptions
  ALTER COLUMN plan_id SET NOT NULL,
  ALTER COLUMN current_period_start SET NOT NULL,
  ALTER COLUMN current_period_end SET NOT NULL;

-- Step 6: Add foreign key constraint
ALTER TABLE user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_plan_id_fkey;

ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_plan_id_fkey 
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id);

-- Step 7: Update status column to use CHECK constraint
ALTER TABLE user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_check 
  CHECK (status IN ('active', 'cancelled', 'expired', 'suspended'));

-- Step 8: Add unique constraint on user_id if it doesn't exist
ALTER TABLE user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_key;

ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);

-- Step 9: Drop old columns
ALTER TABLE user_subscriptions
  DROP COLUMN IF EXISTS plan,
  DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS expires_at;

-- Step 10: Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- Add trigger for updated_at if it doesn't exist
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at 
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE user_subscriptions IS 'User subscription assignments and usage tracking (updated structure)';
