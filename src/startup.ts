import { db } from './database';
import { cacheService } from './services/cache.service';
import { queueService } from './services/queue.service';
import { redisPubSubService } from './services/redis-pubsub.service';
import { redisStorage } from './utils/redis-storage';
import { config } from './config';
import { logger } from './utils/logger';

/**
 * Get bot's user ID for event routing
 */
async function getBotUserId(botId: string): Promise<string | null> {
  try {
    const result = await db.query('SELECT user_id FROM bots WHERE id = $1', [botId]);
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0].user_id;
  } catch (error) {
    logger.error(`Error getting user ID for bot ${botId}:`, error);
    return null;
  }
}

export async function initializeServices(): Promise<void> {
  try {
    // Connect to Redis
    logger.info('Connecting to Redis...');
    await cacheService.connect();
    await redisStorage.connect();
    
    // Check database connection
    logger.info('Checking database connection...');
    const dbHealthy = await db.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }
    
    // Connect to RabbitMQ
    logger.info('Connecting to RabbitMQ...');
    await queueService.connect();
    
    // Check if worker mode is enabled
    const isWorkerMode = config.worker.enabled;
    
    if (isWorkerMode) {
      // Worker mode: Don't restore connections here, worker will handle it
      logger.info('Running in worker mode - skipping Baileys connection restoration in main API');
    } else {
      // Main API mode: Initialize Redis PubSub and subscribe to events
      logger.info('Running in main API mode - initializing Redis PubSub');
      
      await redisPubSubService.connect();
      
      // Subscribe to bot events and forward to WebSocket clients
      await redisPubSubService.subscribeBotEvents({
        onQRGenerated: async (botId: string) => {
          logger.info(`Received qr:generated event for bot ${botId}`);
          try {
            const userId = await getBotUserId(botId);
            if (userId) {
              // Get QR code from Redis
              const qrCode = await redisStorage.getQRCode(botId);
              if (qrCode) {
                const { socketService } = await import('./services/socket.service');
                socketService.emitBotQRCode(userId, botId, qrCode);
                logger.debug(`Forwarded QR code to user ${userId} for bot ${botId}`);
              } else {
                logger.warn(`QR code not found in Redis for bot ${botId}`);
              }
            }
          } catch (error) {
            logger.error(`Error handling qr:generated event for bot ${botId}:`, error);
          }
        },
        onBotConnected: async (botId: string, phoneNumber: string) => {
          logger.info(`Received bot:connected event for bot ${botId}`);
          try {
            const userId = await getBotUserId(botId);
            if (userId) {
              const { socketService } = await import('./services/socket.service');
              socketService.emitBotStatus(userId, botId, 'connected', phoneNumber);
              logger.debug(`Forwarded bot:connected event to user ${userId}`);
            }
          } catch (error) {
            logger.error(`Error handling bot:connected event for bot ${botId}:`, error);
          }
        },
        onBotDisconnected: async (botId: string) => {
          logger.info(`Received bot:disconnected event for bot ${botId}`);
          try {
            const userId = await getBotUserId(botId);
            if (userId) {
              const { socketService } = await import('./services/socket.service');
              socketService.emitBotStatus(userId, botId, 'disconnected');
              logger.debug(`Forwarded bot:disconnected event to user ${userId}`);
            }
          } catch (error) {
            logger.error(`Error handling bot:disconnected event for bot ${botId}:`, error);
          }
        },
        onConnectionLost: async (botId: string, reason: string) => {
          logger.info(`Received bot:connection_lost event for bot ${botId}`);
          try {
            const userId = await getBotUserId(botId);
            if (userId) {
              const { socketService } = await import('./services/socket.service');
              socketService.emitToUser(userId, 'error', {
                botId,
                message: 'Bot connection lost',
                reason,
              });
              logger.debug(`Forwarded bot:connection_lost event to user ${userId}`);
            }
          } catch (error) {
            logger.error(`Error handling bot:connection_lost event for bot ${botId}:`, error);
          }
        },
      });
      
      logger.info('Redis PubSub event subscriptions initialized');
      
      // Restore Baileys only when this process is the only Baileys owner.
      // In Docker, message-worker must own sessions; two processes + one auth dir break send/receive.
      if (config.baileys.skipRestore) {
        logger.info('Skipping Baileys restore (SKIP_BAILEYS_RESTORE=true) — message worker holds WhatsApp connections');
      } else {
        logger.info('Restoring Baileys connections...');
        const { baileysManager } = await import('./services/baileys.service');
        await baileysManager.restoreConnections();
      }
    }
    
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

export async function shutdownServices(): Promise<void> {
  try {
    logger.info('Shutting down services...');

    const { socketService } = await import('./services/socket.service');
    await socketService.close();

    if (!config.worker.enabled) {
      await redisPubSubService.disconnect();
    }

    await redisStorage.disconnect();
    await cacheService.disconnect();
    await queueService.close();
    await db.close();

    logger.info('All services shut down successfully');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
}
