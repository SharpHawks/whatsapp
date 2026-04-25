const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const botId = process.argv[2];

if (!botId) {
  console.error('Usage: node scripts/reset-bot-status.js <botId>');
  process.exit(1);
}

async function resetBotStatus() {
  try {
    const result = await pool.query(
      `UPDATE bots 
       SET connection_status = 'disconnected',
           connection_process_id = NULL,
           connection_hostname = NULL,
           connection_updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, connection_status`,
      [botId]
    );

    if (result.rows.length === 0) {
      console.log(`❌ Bot ${botId} not found`);
    } else {
      console.log(`✅ Bot status reset:`);
      console.table(result.rows);
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetBotStatus();
