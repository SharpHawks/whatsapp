const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'whatsapp_api',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function resetAllBots() {
  try {
    console.log('🔄 Resetting all bots and cleaning sessions...\n');

    // Get all active bots
    const result = await pool.query(
      `SELECT id, name, connection_status FROM bots 
       WHERE is_active = true 
       ORDER BY created_at DESC`
    );

    console.log(`Found ${result.rows.length} active bots\n`);

    // Reset all bots in database
    await pool.query(
      `UPDATE bots 
       SET qr_code = NULL, 
           connection_status = 'disconnected',
           phone_number = NULL
       WHERE is_active = true`
    );
    console.log('✓ Reset all bots in database\n');

    // Delete all session folders
    const sessionsDir = path.join(__dirname, '..', 'sessions');
    
    if (fs.existsSync(sessionsDir)) {
      const folders = fs.readdirSync(sessionsDir);
      console.log(`Found ${folders.length} session folders to delete:`);
      
      for (const folder of folders) {
        const folderPath = path.join(sessionsDir, folder);
        if (fs.statSync(folderPath).isDirectory()) {
          fs.rmSync(folderPath, { recursive: true, force: true });
          console.log(`  ✓ Deleted: ${folder}`);
        }
      }
      console.log('\n✅ All sessions cleaned!');
    } else {
      console.log('ℹ Sessions folder does not exist');
    }

    console.log('\n✅ Reset complete!');
    console.log('All bots have been disconnected and session files removed.');
    console.log('You can now create new bots or reconnect existing ones.');
  } catch (error) {
    console.error('❌ Error during reset:', error);
  } finally {
    await pool.end();
  }
}

resetAllBots();
