const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_api',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkUserBots() {
  try {
    console.log('🔍 Checking user bots...\n');

    // Get user info
    const userResult = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      ['indrikis38@gmail.com']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      await pool.end();
      return;
    }

    const user = userResult.rows[0];
    console.log('👤 User:', user.email);
    console.log('   ID:', user.id);
    console.log('   Role:', user.role);

    // Get balance
    const balanceResult = await pool.query(
      'SELECT amount, currency FROM balances WHERE user_id = $1',
      [user.id]
    );

    if (balanceResult.rows.length > 0) {
      const balance = balanceResult.rows[0];
      console.log(`   Balance: ${balance.currency} ${balance.amount}\n`);
    } else {
      console.log('   Balance: Not set\n');
    }

    // Get bots
    const botsResult = await pool.query(
      `SELECT id, name, connection_status, phone_number, is_active, created_at
       FROM bots
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );

    console.log(`🤖 Bots (${botsResult.rows.length}):`);
    
    if (botsResult.rows.length === 0) {
      console.log('   No bots found\n');
    } else {
      botsResult.rows.forEach((bot, index) => {
        console.log(`\n   ${index + 1}. ${bot.name}`);
        console.log(`      ID: ${bot.id}`);
        console.log(`      Status: ${bot.connection_status}`);
        console.log(`      Phone: ${bot.phone_number || 'Not connected'}`);
        console.log(`      Active: ${bot.is_active}`);
        console.log(`      Created: ${bot.created_at}`);
      });
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    await pool.end();
  }
}

checkUserBots();
