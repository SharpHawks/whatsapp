const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_api',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function cleanupBotSessions() {
  try {
    console.log('Cleaning up bot sessions...');

    // Get all bots with issues
    const result = await pool.query(
      `SELECT id, name, connection_status FROM bots 
       WHERE is_active = true 
       AND connection_status IN ('disconnected', 'qr_required', 'connecting')
       ORDER BY created_at DESC`
    );

    console.log(`Found ${result.rows.length} bots to clean up`);

    for (const bot of result.rows) {
      console.log(`\nBot: ${bot.name} (${bot.id})`);
      console.log(`  Status: ${bot.connection_status}`);

      // Clear QR code and reset status
      await pool.query(
        'UPDATE bots SET qr_code = NULL, connection_status = $1 WHERE id = $2',
        ['disconnected', bot.id]
      );

      // Delete session files
      const sessionPath = path.join(__dirname, '..', 'sessions', bot.id);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`  ✓ Deleted session files`);
      } else {
        console.log(`  ℹ No session files found`);
      }

      console.log(`  ✓ Reset bot status`);
    }

    console.log('\n✅ Cleanup complete!');
    console.log('You can now create new bots or reconnect existing ones.');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await pool.end();
  }
}

cleanupBotSessions();
