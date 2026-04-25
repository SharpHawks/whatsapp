import os from 'os';
import { db } from '../database';
import { logger } from '../utils/logger';
import { cacheService } from './cache.service';

export interface ConnectionStatus {
  botId: string;
  status: 'connecting' | 'qr_required' | 'connected' | 'disconnected';
  processId: number | null;
  hostname: string | null;
  updatedAt: Date;
}

export interface ProcessInfo {
  processId: number;
  hostname: string;
}

export class ConnectionStatusService {
  private readonly CACHE_TTL = 5; // 5 seconds

  /**
   * Update connection status for a bot
   */
  async updateConnectionStatus(
    botId: string,
    status: 'connecting' | 'qr_required' | 'connected' | 'disconnected',
    processInfo?: ProcessInfo
  ): Promise<void> {
    try {
      const pid = processInfo?.processId || process.pid;
      const hostname = processInfo?.hostname || os.hostname();

      logger.debug(`Updating connection status for bot ${botId}`, {
        status,
        processId: pid,
        hostname,
      });

      // Update database
      await db.query(
        `UPDATE bots 
         SET connection_status = $1,
             connection_process_id = $2,
             connection_hostname = $3,
             connection_updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [status, pid, hostname, botId]
      );

      // Invalidate cache
      await this.invalidateCache(botId);

      logger.info(`Connection status updated for bot ${botId}: ${status}`);

      // Emit socket event to frontend
      try {
        await this.emitStatusChange(botId, status, pid, hostname);
      } catch (socketError) {
        logger.error('Failed to emit socket event:', socketError);
        // Don't throw - socket emission failure shouldn't break status update
      }
    } catch (error) {
      logger.error(`Error updating connection status for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Emit status change event via Socket.IO
   */
  private async emitStatusChange(
    botId: string,
    status: string,
    processId: number,
    hostname: string
  ): Promise<void> {
    try {
      // Dynamically import to avoid circular dependencies
      const { socketService } = await import('./socket.service');

      // Get bot's user ID
      const result = await db.query('SELECT user_id FROM bots WHERE id = $1', [botId]);

      if (result.rows.length === 0) {
        logger.warn(`Bot ${botId} not found when emitting status change`);
        return;
      }

      const userId = result.rows[0].user_id;

      // Emit to user's room
      socketService.emitToUser(userId, 'bot:status', {
        botId,
        status,
        processId,
        hostname,
        timestamp: new Date(),
      });

      logger.debug(`Emitted status change for bot ${botId} to user ${userId}`);
    } catch (error) {
      logger.error('Error emitting status change:', error);
      throw error;
    }
  }

  /**
   * Invalidate cache for a bot
   */
  private async invalidateCache(botId: string): Promise<void> {
    try {
      const cacheKey = `connection:status:${botId}`;
      await cacheService.del(cacheKey);
    } catch (error) {
      logger.debug('Error invalidating cache:', error);
      // Don't throw - cache invalidation failure is not critical
    }
  }

  /**
   * Get connection status for a bot (with caching)
   */
  async getConnectionStatus(botId: string): Promise<ConnectionStatus | null> {
    try {
      const cacheKey = `connection:status:${botId}`;

      // Try to get from cache first
      const cached = await cacheService.get<ConnectionStatus>(cacheKey);
      if (cached) {
        logger.debug(`Connection status for bot ${botId} retrieved from cache`);
        return cached;
      }

      // Query database
      const result = await db.query(
        `SELECT 
          id as bot_id,
          connection_status as status,
          connection_process_id as process_id,
          connection_hostname as hostname,
          connection_updated_at as updated_at
         FROM bots 
         WHERE id = $1`,
        [botId]
      );

      if (result.rows.length === 0) {
        logger.warn(`Bot ${botId} not found`);
        return null;
      }

      const row = result.rows[0];
      const status: ConnectionStatus = {
        botId: row.bot_id,
        status: row.status,
        processId: row.process_id,
        hostname: row.hostname,
        updatedAt: row.updated_at,
      };

      // Cache the result
      await cacheService.set(cacheKey, status, this.CACHE_TTL);

      logger.debug(`Connection status for bot ${botId} retrieved from database`);
      return status;
    } catch (error) {
      logger.error(`Error getting connection status for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * List all active connections
   */
  async listActiveConnections(): Promise<ConnectionStatus[]> {
    try {
      const result = await db.query(
        `SELECT 
          id as bot_id,
          connection_status as status,
          connection_process_id as process_id,
          connection_hostname as hostname,
          connection_updated_at as updated_at
         FROM bots 
         WHERE connection_status = 'connected'
         ORDER BY connection_updated_at DESC`
      );

      const connections: ConnectionStatus[] = result.rows.map((row) => ({
        botId: row.bot_id,
        status: row.status,
        processId: row.process_id,
        hostname: row.hostname,
        updatedAt: row.updated_at,
      }));

      logger.debug(`Found ${connections.length} active connections`);
      return connections;
    } catch (error) {
      logger.error('Error listing active connections:', error);
      throw error;
    }
  }

  /**
   * Cleanup stale connections (connections not updated in last 60 seconds)
   */
  async cleanupStaleConnections(): Promise<number> {
    try {
      logger.info('Cleaning up stale connections...');

      const result = await db.query(
        `UPDATE bots 
         SET connection_status = 'disconnected',
             connection_process_id = NULL,
             connection_hostname = NULL
         WHERE connection_status IN ('connecting', 'connected')
         AND connection_updated_at < NOW() - INTERVAL '60 seconds'
         RETURNING id`
      );

      const count = result.rows.length;

      if (count > 0) {
        logger.info(`Cleaned up ${count} stale connections`);

        // Invalidate cache for cleaned up bots
        for (const row of result.rows) {
          await this.invalidateCache(row.id);
        }
      } else {
        logger.debug('No stale connections found');
      }

      return count;
    } catch (error) {
      logger.error('Error cleaning up stale connections:', error);
      throw error;
    }
  }
}

export const connectionStatusService = new ConnectionStatusService();
