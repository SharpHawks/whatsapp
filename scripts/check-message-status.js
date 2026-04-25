const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_api',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkMessageStatus() {
  try {
    const messageId = process.argv[2] || '64be9ac1-d919-4afe-a48b-e91720442178';

    console.log('📨 Checking message status...\n');
    console.log('Message ID:', messageId, '\n');

    const result = await pool.query(
      `SELECT id, bot_id, direction, status, whatsapp_message_id,
              from_number, to_number, type, content, cost, timestamp, updated_at
       FROM messages
       WHERE id = $1`,
      [messageId]
    );

    if (result.rows.length === 0) {
      console.log('❌ Message not found');
      await pool.end();
      return;
    }

    const message = result.rows[0];
    console.log('📋 Message Details:');
    console.log('   Bot ID:', message.bot_id);
    console.log('   Direction:', message.direction);
    console.log('   Status:', message.status);
    console.log('   WhatsApp ID:', message.whatsapp_message_id || 'None');
    console.log('   From:', message.from_number);
    console.log('   To:', message.to_number);
    console.log('   Type:', message.type);
    console.log('   Cost:', message.cost);
    console.log('   Content:', JSON.stringify(message.content, null, 2));
    console.log('   Created:', message.timestamp);
    console.log('   Updated:', message.updated_at);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    await pool.end();
  }
}

checkMessageStatus();
