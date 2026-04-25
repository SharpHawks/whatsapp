-- Store API keys encrypted at rest so owners can reveal them after password verification.
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS encrypted_key TEXT;

COMMENT ON COLUMN api_keys.encrypted_key IS 'AES-GCM encrypted plaintext API key for owner reveal after password verification';
