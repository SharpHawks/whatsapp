import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config';
import { logger } from '../src/utils/logger';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

async function runMigration(direction: 'up' | 'down' = 'up', migrationNumber?: string) {
  const client = await pool.connect();
  
  try {
    const migrationsDir = direction === 'up' 
      ? path.join(__dirname, '../migrations')
      : path.join(__dirname, '../migrations/down');
    
    // Get all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    // If specific migration number provided, run only that one
    const migrationsToRun = migrationNumber 
      ? files.filter(f => f.startsWith(migrationNumber))
      : files;
    
    if (migrationsToRun.length === 0) {
      logger.warn(`No migrations found to run`);
      return;
    }
    
    for (const file of migrationsToRun) {
      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      
      logger.info(`Running migration ${direction}: ${file}...`);
      await client.query(sql);
      logger.info(`Migration ${direction} completed: ${file}`);
    }
    
    logger.info(`All migrations completed successfully`);
  } catch (error) {
    logger.error(`Migration ${direction} failed:`, error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const direction = process.argv[2] as 'up' | 'down' || 'up';
const migrationNumber = process.argv[3];
runMigration(direction, migrationNumber);
