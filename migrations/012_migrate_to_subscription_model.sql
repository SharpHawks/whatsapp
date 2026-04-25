-- Migration: Migrate from wallet-based billing to pure subscription model
-- 1. Add Stripe price/product IDs to subscription_plans
-- 2. Add stripe columns to users for subscription management
-- 3. Add subscription management to user_subscriptions
-- 4. Create scheduled subscription renewal tracking
-- 5. Migrate existing balance data to credit note (not used for billing anymore)

-- Step 1: Add Stripe fields to subscription_plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS stripe_price_id_yearly VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Step 2: Add subscription management fields to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;

-- Step 3: Update user_subscriptions for proper subscription management
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(20) DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS renewal_count INTEGER DEFAULT 0;

-- Step 4: Create subscription events audit log
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  event_type VARCHAR(50) NOT NULL, -- 'subscription_created', 'subscription_updated', 'subscription_cancelled', 'subscription_expired', 'subscription_renewed', 'plan_changed', 'payment_failed'
  stripe_event_id VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at);

-- Step 5: Create invocations table for per-message billing (optional, if you want to track all messages)
-- Not strictly necessary since usage_logs already tracks this

-- Step 6: Update default plans with proper stripe IDs (will be filled in when you create products in Stripe dashboard)
-- For now, we leave stripe_price_id NULL and the admin will configure them

UPDATE subscription_plans SET sort_order = 1 WHERE slug = 'free';
UPDATE subscription_plans SET sort_order = 2 WHERE slug = 'basic';
UPDATE subscription_plans SET sort_order = 3 WHERE slug = 'pro';
UPDATE subscription_plans SET sort_order = 4 WHERE slug = 'business';

-- Step 7: Ensure all existing non-owner users have a user_subscriptions record
INSERT INTO user_subscriptions (user_id, plan_id, current_period_start, current_period_end, billing_interval)
SELECT
  u.id,
  (SELECT id FROM subscription_plans WHERE slug = 'free' LIMIT 1),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  'monthly'
FROM users u
WHERE u.role != 'owner'
  AND NOT EXISTS (SELECT 1 FROM user_subscriptions WHERE user_id = u.id);

-- Step 8: Balances table becomes "legacy" credits table — we keep it for any existing credit but messages no longer deduct from it
-- Existing users keep their balance as account credit (can be refunded or used for add-ons later)
-- Going forward, new users get amount = 0

-- Step 9: Add comment explaining the migration
COMMENT ON TABLE balances IS 'Legacy wallet balances. In the subscription model, this is no longer used for message billing. Kept for existing user credits.';
COMMENT ON TABLE transactions IS 'Legacy wallet transactions. New billing events are recorded in subscription_events.';
COMMENT ON TABLE subscription_events IS 'Audit trail of all subscription lifecycle events';

-- Step 10: Add triggers for updated_at on new tables
DROP TRIGGER IF EXISTS update_subscription_events_updated_at ON subscription_events;
CREATE TRIGGER update_subscription_events_updated_at
  BEFORE UPDATE ON subscription_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
