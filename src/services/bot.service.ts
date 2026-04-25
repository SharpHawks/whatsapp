import { db } from '../database';
import { Bot } from '../types';
import { authService } from './auth.service';
import { redisPubSubService } from './redis-pubsub.service';
import { redisStorage } from '../utils/redis-storage';
import { NotFoundError, ValidationError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

const MAX_BOTS_PER_USER = 10;

export class BotService {
  async createBot(userId: string, name: string, webhookUrl?: string): Promise<Bot> {
    // Check bot count limit
    const botCount = await this.getBotCount(userId);
    if (botCount >= MAX_BOTS_PER_USER) {
      throw new ValidationError(`Maximum number of bots (${MAX_BOTS_PER_USER}) reached`);
    }

    // Validate webhook URL if provided
    if (webhookUrl && !this.isValidUrl(webhookUrl)) {
      throw new ValidationError('Invalid webhook URL format');
    }

    // Create bot first
    const botResult = await db.query<Bot>(
      `INSERT INTO bots (user_id, name, webhook_url, auto_response_enabled, connection_status, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id as "userId", name, phone_number as "phoneNumber", 
                 webhook_url as "webhookUrl", auto_response_enabled as "autoResponseEnabled",
                 connection_status as "status", qr_code as "qrCode", 
                 is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      [userId, name, webhookUrl || null, false, 'disconnected', true]
    );

    const bot = botResult.rows[0];

    // Generate API key for bot (after bot is created)
    await authService.generateApiKey(userId, bot.id);

    // Automatically initiate connection to generate QR code
    await this.connectBot(bot.id, userId);

    logger.info(`Bot created: ${bot.id} for user: ${userId}`);
    return bot;
  }

  async getBot(botId: string, userId: string): Promise<Bot> {
    const result = await db.query<Bot>(
      `SELECT id, user_id as "userId", name, phone_number as "phoneNumber", 
              webhook_url as "webhookUrl", auto_response_enabled as "autoResponseEnabled",
              connection_status as "status", qr_code as "qrCode", 
              is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
       FROM bots
       WHERE id = $1 AND user_id = $2 AND is_active = true`,
      [botId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError(ErrorCode.BOT_NOT_FOUND, 'Bot not found');
    }

    return result.rows[0];
  }

  async listBots(userId: string): Promise<Bot[]> {
    const result = await db.query<Bot>(
      `SELECT id, user_id as "userId", name, phone_number as "phoneNumber", 
              webhook_url as "webhookUrl", auto_response_enabled as "autoResponseEnabled",
              connection_status as "status", qr_code as "qrCode", 
              is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
       FROM bots
       WHERE user_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async updateBot(
    botId: string,
    userId: string,
    updates: { name?: string; webhookUrl?: string; autoResponseEnabled?: boolean }
  ): Promise<Bot> {
    // Verify bot ownership
    await this.getBot(botId, userId);

    // Validate webhook URL if provided
    if (updates.webhookUrl && !this.isValidUrl(updates.webhookUrl)) {
      throw new ValidationError('Invalid webhook URL format');
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.webhookUrl !== undefined) {
      setClauses.push(`webhook_url = $${paramIndex++}`);
      values.push(updates.webhookUrl);
    }

    if (updates.autoResponseEnabled !== undefined) {
      setClauses.push(`auto_response_enabled = $${paramIndex++}`);
      values.push(updates.autoResponseEnabled);
    }

    if (setClauses.length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    values.push(botId, userId);

    const result = await db.query<Bot>(
      `UPDATE bots
       SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING id, user_id as "userId", name, phone_number as "phoneNumber", 
                 webhook_url as "webhookUrl", auto_response_enabled as "autoResponseEnabled",
                 connection_status as "status", qr_code as "qrCode", 
                 is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );

    logger.info(`Bot updated: ${botId}`);
    return result.rows[0];
  }

  async deleteBot(botId: string, userId: string): Promise<void> {
    // Verify bot ownership
    await this.getBot(botId, userId);

    // Disconnect bot via Redis event
    await this.disconnectBot(botId, userId);

    // Soft delete
    await db.query(
      'UPDATE bots SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [botId]
    );

    logger.info(`Bot deleted: ${botId}`);
  }

  async getBotCount(userId: string): Promise<number> {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM bots WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Connect bot via Redis event
   * @param botId - Bot identifier
   * @param userId - User identifier for ownership verification
   */
  async connectBot(botId: string, userId: string): Promise<void> {
    // Verify ownership and get current bot status
    const bot = await this.getBot(botId, userId);

    // Check if bot is already connected
    if (bot.status === 'connected') {
      logger.warn(`Bot ${botId} is already connected`);
      throw new ValidationError('Bot is already connected');
    }

    // Check if bot is already connecting
    if (bot.status === 'connecting' || bot.status === 'qr_required') {
      logger.info(`Bot ${botId} is already in connecting state (${bot.status})`);
      // Allow reconnection attempt - this is not an error
    }

    // Update status to connecting
    await db.query(
      'UPDATE bots SET connection_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['connecting', botId]
    );

    // Publish connect event
    await redisPubSubService.publishBotConnect(botId);

    logger.info(`Bot connect requested: ${botId} (previous status: ${bot.status})`);
  }

  /**
   * Disconnect bot via Redis event
   * @param botId - Bot identifier
   * @param userId - User identifier for ownership verification
   */
  async disconnectBot(botId: string, userId: string): Promise<void> {
    // Verify ownership
    await this.getBot(botId, userId);

    // Publish disconnect event
    await redisPubSubService.publishBotDisconnect(botId);

    logger.info(`Bot disconnect requested: ${botId}`);
  }

  /**
   * Get QR code from Redis
   * @param botId - Bot identifier
   * @param userId - User identifier for ownership verification
   * @returns QR code string or null if not available
   */
  async getQRCode(botId: string, userId: string): Promise<string | null> {
    // Verify ownership
    await this.getBot(botId, userId);

    // Get QR code from Redis
    const qrCode = await redisStorage.getQRCode(botId);

    if (qrCode) {
      logger.debug(`QR code retrieved for bot ${botId}`);
    } else {
      logger.debug(`QR code not available for bot ${botId}`);
    }

    return qrCode;
  }

  /**
   * Get detailed bot status including health metrics
   * @param botId - Bot identifier
   * @param userId - User identifier for ownership verification
   * @returns Detailed status information
   */
  async getBotStatus(botId: string, userId: string): Promise<{
    botId: string;
    status: string;
    phoneNumber?: string;
    health?: any;
    lastActivity?: string;
    uptime?: number;
    reconnectAttempts?: number;
  }> {
    // Verify ownership
    const bot = await this.getBot(botId, userId);

    // Get health metrics from Redis
    const health = await redisStorage.getConnectionHealth(botId);

    // Get connection state from Redis
    const connectionState = await redisStorage.getConnectionState(botId);

    return {
      botId: bot.id,
      status: bot.status,
      phoneNumber: bot.phoneNumber,
      health: health ? {
        status: health.status,
        lastMessageSent: health.lastMessageSent,
        lastMessageReceived: health.lastMessageReceived,
        reconnectAttempts: health.reconnectAttempts,
        uptime: health.uptime,
        errors: health.errors.slice(-5), // Last 5 errors
      } : null,
      lastActivity: connectionState?.lastSeen?.toISOString(),
      uptime: health?.uptime,
      reconnectAttempts: health?.reconnectAttempts || 0,
    };
  }

  /**
   * Get bot groups with caching
   * @param botId - Bot identifier
   * @param userId - User identifier for ownership verification
   * @returns List of groups the bot is a member of
   */
  async getBotGroups(botId: string, userId: string): Promise<Array<{
    id: string;
    name: string;
    participantCount: number;
    isAdmin: boolean;
  }>> {
    // Verify ownership
    await this.getBot(botId, userId);

    // Import cache service
    const { cacheService } = await import('./cache.service');
    
    // Try to get from cache first
    const cacheKey = `bot:groups:${botId}`;
    const cachedGroups = await cacheService.get<Array<{
      id: string;
      name: string;
      participantCount: number;
      isAdmin: boolean;
    }>>(cacheKey);

    if (cachedGroups) {
      logger.debug(`Retrieved ${cachedGroups.length} groups from cache for bot ${botId}`);
      return cachedGroups;
    }

    // Check if we're in worker mode
    const { config } = await import('../config');
    const isWorkerMode = config.worker.enabled;

    let groups: Array<{
      id: string;
      name: string;
      participantCount: number;
      isAdmin: boolean;
    }>;

    if (isWorkerMode) {
      // We're in worker mode - get groups directly from local manager
      logger.debug(`Getting groups locally (worker mode) for bot ${botId}`);
      const { workerBaileysManager } = await import('./worker-baileys.manager');
      groups = await workerBaileysManager.getGroups(botId);
    } else {
      // We're in API mode - call worker via HTTP
      logger.debug(`Getting groups from worker via HTTP for bot ${botId}`);
      const workerUrl = `http://${config.worker.hostname || 'message-worker'}:${config.worker.healthPort || 3001}/groups/${botId}`;
      
      try {
        const response = await fetch(workerUrl);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
          throw new Error(errorData.error || `Worker returned status ${response.status}`);
        }
        
        const data = await response.json() as { groups: Array<{
          id: string;
          name: string;
          participantCount: number;
          isAdmin: boolean;
        }> };
        groups = data.groups;
      } catch (error) {
        logger.error(`Error calling worker for groups:`, error);
        throw new Error(`Failed to get groups from worker: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Cache the result with 5-minute TTL (300 seconds)
    await cacheService.set(cacheKey, groups, 300);
    
    logger.info(`Retrieved and cached ${groups.length} groups for bot ${botId}`);
    return groups;
  }

  /**
   * Invalidate groups cache for a bot
   * Called when bot reconnects to refresh group list
   * @param botId - Bot identifier
   */
  async invalidateGroupsCache(botId: string): Promise<void> {
    try {
      const { cacheService } = await import('./cache.service');
      const cacheKey = `bot:groups:${botId}`;
      await cacheService.del(cacheKey);
      logger.debug(`Invalidated groups cache for bot ${botId}`);
    } catch (error) {
      logger.error(`Error invalidating groups cache for bot ${botId}:`, error);
      // Don't throw - this is not critical
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

export const botService = new BotService();
