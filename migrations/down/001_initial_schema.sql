-- Drop triggers
DROP TRIGGER IF EXISTS update_baileys_sessions_updated_at ON baileys_sessions;
DROP TRIGGER IF EXISTS update_balances_updated_at ON balances;
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
DROP TRIGGER IF EXISTS update_bots_updated_at ON bots;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse order (respecting foreign key constraints)
DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS balances;
DROP TABLE IF EXISTS media_files;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS auto_response_rules;
DROP TABLE IF EXISTS baileys_sessions;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS bots;
DROP TABLE IF EXISTS users;

-- Drop extension
DROP EXTENSION IF EXISTS "uuid-ossp";
