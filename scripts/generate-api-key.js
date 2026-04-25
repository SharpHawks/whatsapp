const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_api',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function generateApiKey() {
  try {
    const botId = 'dd186384-e89c-43d6-8d18-fe640c898317'; // Connected bot
    const userId = 'be9999b8-02c0-4f58-9b15-cc6912028ca5';

    console.log('🔑 Generating API key...\n');

    // Generate random API key
    const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Deactivate old keys for this bot
    await pool.query(
      'UPDATE api_keys SET is_active = false WHERE bot_id = $1',
      [botId]
    );

    // Insert new key
    await pool.query(
      `INSERT INTO api_keys (key_hash, user_id, bot_id, is_active)
       VALUES ($1, $2, $3, $4)`,
      [keyHash, userId, botId, true]
    );

    console.log('✅ API Key generated successfully!\n');
    console.log('🔐 API Key:', apiKey);
    console.log('\n⚠️  Save this key securely - it won\'t be shown again!\n');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

generateApiKey();
