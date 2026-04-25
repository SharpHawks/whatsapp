const { db } = require('../dist/database');

async function checkBots() {
  try {
    const result = await db.query(`
      SELECT id, name, connection_status, phone_number, qr_code IS NOT NULL as has_qr
      FROM bots 
      WHERE is_active = true 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    console.log('\n=== Active Bots ===');
    result.rows.forEach(bot => {
      console.log(`\nBot: ${bot.name}`);
      console.log(`  ID: ${bot.id}`);
      console.log(`  Status: ${bot.connection_status}`);
      console.log(`  Phone: ${bot.phone_number || 'Not connected'}`);
      console.log(`  Has QR: ${bot.has_qr}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkBots();
