import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      min: config.database.poolMin,
      max: config.database.poolMax,
      idleTimeoutMillis: config.database.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis ?? 6000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error:', err);
    });

    this.pool.on('connect', () => {
      logger.info('New database connection established');
    });
  }

  private readonly SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000', 10);

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      if (duration > this.SLOW_QUERY_MS) {
        logger.warn('Slow query', { duration: `${duration}ms`, text: text.substring(0, 100), rows: result.rowCount });
      } else {
        logger.debug('Executed query', { text, duration, rows: result.rowCount });
      }
      return result;
    } catch (error) {
      logger.error('Database query error:', { text, error });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database pool closed');
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}

export const db = new Database();
