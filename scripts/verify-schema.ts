import { Pool } from 'pg';
import { config } from '../src/config';
import { logger } from '../src/utils/logger';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

async function verifySchema() {
  const client = await pool.connect();
  
  try {
    // Check if the new columns exist
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bots'
      AND column_name IN ('connection_process_id', 'connection_hostname', 'connection_updated_at')
      ORDER BY column_name;
    `);
    
    logger.info('Process tracking columns in bots table:');
    result.rows.forEach(row => {
      logger.info(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check if the index exists
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'bots'
      AND indexname = 'idx_bots_connection_monitoring';
    `);
    
    if (indexResult.rows.length > 0) {
      logger.info('Index idx_bots_connection_monitoring exists:');
      logger.info(`  ${indexResult.rows[0].indexdef}`);
    } else {
      logger.warn('Index idx_bots_connection_monitoring not found');
    }
    
    logger.info('Schema verification completed successfully');
  } catch (error) {
    logger.error('Schema verification failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifySchema();
