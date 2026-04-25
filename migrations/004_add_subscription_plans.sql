-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10, 2),
  message_quota INTEGER NOT NULL DEFAULT 100,
  bot_limit INTEGER NOT NULL DEFAULT 1,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'suspended')),
  current_period_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  current_period_end TIMESTAMP NOT NULL,
  messages_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Create usage tracking table
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
  resource_count INTEGER DEFAULT 1,
  bypassed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, message_quota, bot_limit, features) VALUES
  ('Free', 'free', 'Perfect for testing and small projects', 0, 0, 100, 1, '["100 messages/month", "1 bot", "Basic support", "API access"]'),
  ('Basic', 'basic', 'Great for small businesses', 9.99, 99.99, 1000, 3, '["1,000 messages/month", "3 bots", "Email support", "API access", "Webhook support"]'),
  ('Pro', 'pro', 'For growing businesses', 29.99, 299.99, 10000, 10, '["10,000 messages/month", "10 bots", "Priority support", "API access", "Webhook support", "Advanced analytics"]'),
  ('Business', 'business', 'For large organizations', 99.99, 999.99, 100000, 50, '["100,000 messages/month", "50 bots", "24/7 support", "API access", "Webhook support", "Advanced analytics", "Custom integrations", "Dedicated account manager"]');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- Assign free plan to existing users (except owners)
INSERT INTO user_subscriptions (user_id, plan_id, current_period_start, current_period_end)
SELECT 
  u.id,
  (SELECT id FROM subscription_plans WHERE slug = 'free' LIMIT 1),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days'
FROM users u
WHERE u.role != 'owner' 
  AND NOT EXISTS (SELECT 1 FROM user_subscriptions WHERE user_id = u.id);

-- Add comments
COMMENT ON TABLE subscription_plans IS 'Available subscription plans with pricing and quotas';
COMMENT ON TABLE user_subscriptions IS 'User subscription assignments and usage tracking';
COMMENT ON TABLE usage_logs IS 'Detailed logs of user actions for billing and analytics';
