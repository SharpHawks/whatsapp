const { Client } = require('pg');
require('dotenv').config();

async function applyMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'whatsapp_api',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const sql = `
      -- Add connection tracking fields to bots table
      ALTER TABLE bots ADD COLUMN IF NOT EXISTS connection_process_id INTEGER;
      ALTER TABLE bots ADD COLUMN IF NOT EXISTS connection_hostname VARCHAR(255);
      ALTER TABLE bots ADD COLUMN IF NOT EXISTS connection_updated_at TIMESTAMP;

      -- Add indexes for connection tracking
      CREATE INDEX IF NOT EXISTS idx_bots_connection_process ON bots(connection_process_id);
      CREATE INDEX IF NOT EXISTS idx_bots_connection_hostname ON bots(connection_hostname);
    `;

    console.log('📝 Applying migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully');

    await client.end();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
