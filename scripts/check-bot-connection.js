const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_api',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkBotConnection() {
  try {
    const botId = '034ee70d-767d-4d61-a464-6206ffe7628a';

    console.log('🤖 Checking bot connection...\n');

    const result = await pool.query(
      `SELECT id, name, connection_status, phone_number, 
              connection_process_id, connection_hostname, connection_updated_at
       FROM bots
       WHERE id = $1`,
      [botId]
    );

    if (result.rows.length === 0) {
      console.log('❌ Bot not found');
      await pool.end();
      return;
    }

    const bot = result.rows[0];
    console.log('📋 Bot Details:');
    console.log('   Name:', bot.name);
    console.log('   Status:', bot.connection_status);
    console.log('   Phone:', bot.phone_number || 'Not set');
    console.log('   Process ID:', bot.connection_process_id || 'None');
    console.log('   Hostname:', bot.connection_hostname || 'None');
    console.log('   Last Updated:', bot.connection_updated_at || 'Never');

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

checkBotConnection();
