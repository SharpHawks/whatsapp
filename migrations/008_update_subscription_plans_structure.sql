-- Migration to update subscription_plans table structure
-- Add missing columns that are expected by the application

-- Step 1: Add missing columns
ALTER TABLE subscription_plans 
  ADD COLUMN IF NOT EXISTS slug VARCHAR(50),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS price_monthly DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS price_yearly DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS message_quota INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS bot_limit INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Step 2: Copy old 'price' values when upgrading older schemas.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'subscription_plans'
      AND column_name = 'price'
  ) THEN
    UPDATE subscription_plans
    SET price_monthly = price
    WHERE price_monthly IS NULL;
  END IF;
END $$;

UPDATE subscription_plans
SET price_monthly = 0
WHERE price_monthly IS NULL;

-- Step 3: Set default values based on plan name
UPDATE subscription_plans
SET 
  slug = LOWER(name),
  description = CASE 
    WHEN name = 'Free' THEN 'Perfect for testing and small projects'
    WHEN name = 'Basic' THEN 'Great for small businesses'
    WHEN name = 'Pro' THEN 'For growing businesses'
    WHEN name = 'Business' THEN 'For large organizations'
    ELSE 'Subscription plan'
  END,
  price_yearly = CASE 
    WHEN name = 'Free' THEN 0
    WHEN name = 'Basic' THEN 99.99
    WHEN name = 'Pro' THEN 299.99
    WHEN name = 'Business' THEN 999.99
    ELSE price_monthly * 10
  END,
  message_quota = CASE 
    WHEN name = 'Free' THEN 100
    WHEN name = 'Basic' THEN 1000
    WHEN name = 'Pro' THEN 10000
    WHEN name = 'Business' THEN 100000
    ELSE 100
  END,
  bot_limit = CASE 
    WHEN name = 'Free' THEN 1
    WHEN name = 'Basic' THEN 3
    WHEN name = 'Pro' THEN 10
    WHEN name = 'Business' THEN 50
    ELSE 1
  END,
  is_active = TRUE
WHERE slug IS NULL;

-- Step 4: Make required columns NOT NULL
ALTER TABLE subscription_plans
  ALTER COLUMN price_monthly SET NOT NULL,
  ALTER COLUMN message_quota SET NOT NULL,
  ALTER COLUMN bot_limit SET NOT NULL;

-- Step 5: Add unique constraint on slug
ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_slug_key;

ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_slug_key UNIQUE (slug);

-- Step 6: Drop old 'price' column if it exists
ALTER TABLE subscription_plans
  DROP COLUMN IF EXISTS price;

-- Step 7: Add trigger for updated_at if it doesn't exist
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at 
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE subscription_plans IS 'Available subscription plans with pricing and quotas (updated structure)';
