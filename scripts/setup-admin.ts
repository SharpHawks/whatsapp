import { db } from '../src/database';
import { logger } from '../src/utils/logger';
import fs from 'fs';
import path from 'path';

const ADMIN_EMAIL = 'indrikis38@gmail.com';

async function setupAdmin() {
  try {
    logger.info('Starting database cleanup and admin setup...');

    // 1. Get admin user ID
    const adminResult = await db.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);

    if (adminResult.rows.length === 0) {
      logger.error(`Admin user ${ADMIN_EMAIL} not found!`);
      process.exit(1);
    }

    const adminUserId = adminResult.rows[0].id;
    logger.info(`Found admin user: ${ADMIN_EMAIL} (${adminUserId})`);

    // 2. Delete all bots (this will cascade delete related data)
    logger.info('Deleting all bots...');
    const botsResult = await db.query('DELETE FROM bots RETURNING id');
    logger.info(`Deleted ${botsResult.rows.length} bots`);

    // 3. Delete all users except admin
    logger.info('Deleting all users except admin...');
    const usersResult = await db.query('DELETE FROM users WHERE email != $1 RETURNING id', [
      ADMIN_EMAIL,
    ]);
    logger.info(`Deleted ${usersResult.rows.length} users`);

    // 4. Update admin user to have admin role
    logger.info('Setting admin role...');
    await db.query(
      `UPDATE users 
       SET email_verified = true,
           updated_at = CURRENT_TIMESTAMP 
       WHERE email = $1`,
      [ADMIN_EMAIL]
    );
    logger.info('Admin role set successfully');

    // 5. Clean up sessions directory
    const sessionsPath = path.join(process.cwd(), 'sessions');
    if (fs.existsSync(sessionsPath)) {
      logger.info('Cleaning up sessions directory...');
      const files = fs.readdirSync(sessionsPath);
      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join(sessionsPath, file);
        if (fs.statSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
          deletedCount++;
        }
      }
      logger.info(`Deleted ${deletedCount} session directories`);
    }

    // 6. Clean up baileys_sessions table
    logger.info('Cleaning up baileys_sessions table...');
    const sessionsResult = await db.query('DELETE FROM baileys_sessions RETURNING bot_id');
    logger.info(`Deleted ${sessionsResult.rows.length} baileys sessions`);

    // 7. Show final stats
    logger.info('\n=== Database Cleanup Complete ===');
    const stats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM bots) as bots_count,
        (SELECT COUNT(*) FROM messages) as messages_count,
        (SELECT COUNT(*) FROM baileys_sessions) as sessions_count
    `);

    logger.info('Current database state:');
    logger.info(`  Users: ${stats.rows[0].users_count}`);
    logger.info(`  Bots: ${stats.rows[0].bots_count}`);
    logger.info(`  Messages: ${stats.rows[0].messages_count}`);
    logger.info(`  Sessions: ${stats.rows[0].sessions_count}`);

    logger.info(`\nAdmin user ${ADMIN_EMAIL} is ready to use!`);
    logger.info('Database has been cleaned successfully.');

    process.exit(0);
  } catch (error) {
    logger.error('Error during setup:', error);
    process.exit(1);
  }
}

setupAdmin();
