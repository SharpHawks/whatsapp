-- Upsert default subscription plans using the current subscription_plans schema.
INSERT INTO subscription_plans (
  name,
  slug,
  description,
  price_monthly,
  price_yearly,
  message_quota,
  bot_limit,
  features,
  is_active
) VALUES
  ('Free', 'free', 'Perfect for testing and small projects', 0, 0, 100, 1, '["100 messages/month", "1 bot", "Basic support", "API access"]', true),
  ('Basic', 'basic', 'Great for small businesses', 9.99, 99.99, 1000, 3, '["1,000 messages/month", "3 bots", "Email support", "API access", "Webhook support"]', true),
  ('Pro', 'pro', 'For growing businesses', 29.99, 299.99, 10000, 10, '["10,000 messages/month", "10 bots", "Priority support", "API access", "Webhook support", "Advanced analytics"]', true),
  ('Business', 'business', 'For large organizations', 99.99, 999.99, 100000, 50, '["100,000 messages/month", "50 bots", "24/7 support", "API access", "Webhook support", "Advanced analytics", "Custom integrations", "Dedicated account manager"]', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  message_quota = EXCLUDED.message_quota,
  bot_limit = EXCLUDED.bot_limit,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;
