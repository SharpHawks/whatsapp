import { WASocket } from '@whiskeysockets/baileys';
import { createServer } from 'http';
import { db } from '../database';
import { queueService } from '../services/queue.service';
import { workerBaileysManager } from '../services/worker-baileys.manager';
import { lockService } from '../services/lock.service';
import { cacheService } from '../services/cache.service';
import { redisPubSubService } from '../services/redis-pubsub.service';
import { redisStorage } from '../utils/redis-storage';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SendMessageRequest } from '../types';
import { getMetrics, getContentType, messagesSentTotal, activeConnectionsGauge } from '../config/metrics';

interface QueuedMessage {
  id: string;
  botId: string;
  userId: string;
  request: SendMessageRequest;
  attempts: number;
  queuedAt: Date;
}

export class MessageWorker {
  private isShuttingDown: boolean = false;
  private activeMessages: Set<string> = new Set();
  // Increased timeout to handle connection instability and reconnection delays
  private readonly MESSAGE_TIMEOUT = 30000; // 30 seconds
  private healthServer: ReturnType<typeof createServer> | null = null;

  async start(): Promise<void> {
    try {
      logger.info('Starting message worker...');

      // Check if worker mode is enabled
      if (!config.worker.enabled) {
        logger.warn('Worker mode is disabled in configuration');
        return;
      }

      // Connect to Redis for locking, caching, PubSub, and storage
      await lockService.connect();
      await cacheService.connect();
      await redisPubSubService.connect();
      await redisStorage.connect();
      logger.info('Connected to Redis');

      // Initialize WorkerBaileysManager
      logger.info('Initializing Worker Baileys Manager...');
      await workerBaileysManager.initialize();
      logger.info('Worker Baileys Manager initialized');

      // Set up graceful shutdown handlers
      this.setupShutdownHandlers();

      // Start health check HTTP server
      this.startHealthServer();

      // Connect to queue
      await queueService.connect();
      logger.info('Connected to message queue');

      // Start consuming messages
      await queueService.consumeMessages(async (message) => {
        // Reject messages if shutting down
        if (this.isShuttingDown) {
          logger.info(`Rejecting message ${message.id} - worker is shutting down`);
          throw new Error('Worker is shutting down');
        }

        await this.processMessage(message);
      });

      logger.info('Message worker started successfully');
    } catch (error) {
      logger.error('Failed to start message worker:', error);
      throw error;
    }
  }

  /**
   * Start health check HTTP server
   */
  private startHealthServer(): void {
    const port = config.worker.healthPort || 3001;

    this.healthServer = createServer(async (req, res) => {
      // Health check endpoint
      if (req.url === '/health' && req.method === 'GET') {
        try {
          const health = await workerBaileysManager.getWorkerHealth();
          const allHealth = workerBaileysManager.getAllConnectionHealth();

          const response = {
            worker: health,
            activeMessages: this.activeMessages.size,
            isShuttingDown: this.isShuttingDown,
            connections: allHealth.map(h => ({
              botId: h.botId,
              status: h.status,
              reconnectAttempts: h.reconnectAttempts,
              uptime: h.uptime,
              errors: h.errors.length,
            })),
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response, null, 2));
        } catch (error) {
          logger.error('Error generating health response:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
      // Prometheus metrics endpoint
      else if (req.url === '/metrics' && req.method === 'GET') {
        try {
          const allHealth = workerBaileysManager.getAllConnectionHealth();
          const connectedCount = allHealth.filter(h => h.status === 'healthy').length;
          activeConnectionsGauge.set(connectedCount);

          res.writeHead(200, { 'Content-Type': getContentType() });
          res.end(await getMetrics());
        } catch (error) {
          logger.error('Error generating metrics:', error);
          res.writeHead(500);
          res.end();
        }
      }
      // Get groups endpoint
      else if (req.url?.startsWith('/groups/') && req.method === 'GET') {
        try {
          const botId = req.url.split('/groups/')[1];
          
          if (!botId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Bot ID is required' }));
            return;
          }

          logger.debug(`Worker received groups request for bot ${botId}`);
          
          const groups = await workerBaileysManager.getGroups(botId);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ groups }));
        } catch (error) {
          logger.error('Error getting groups from worker:', error);
          const errorMessage = error instanceof Error ? error.message : 'Internal server error';
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: errorMessage }));
        }
      }
      else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    this.healthServer.listen(port, () => {
      logger.info(`Worker health check server listening on port ${port}`);
    });

    this.healthServer.on('error', (error) => {
      logger.error('Health server error:', error);
    });
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        logger.warn('Shutdown already in progress');
        return;
      }

      logger.info(`${signal} received - initiating graceful shutdown`);
      await this.handleShutdown();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  private async processMessage(message: QueuedMessage): Promise<void> {
    // Track active message
    this.activeMessages.add(message.id);

    try {
      logger.info(`Processing message ${message.id} for bot ${message.botId}`);

      // Wrap processing in timeout
      await this.processMessageWithTimeout(message);

      logger.info(`Message ${message.id} processed successfully`);
    } catch (error) {
      logger.error(`Failed to process message ${message.id}:`, error);
      await this.updateMessageStatus(message.id, 'failed');
      messagesSentTotal.inc({ type: message.request.type, status: 'failed' });
      throw error;
    } finally {
      // Remove from active messages
      this.activeMessages.delete(message.id);
    }
  }

  /**
   * Process message with timeout
   */
  private async processMessageWithTimeout(message: QueuedMessage): Promise<void> {
    return Promise.race([
      this.doProcessMessage(message),
      this.createTimeout(message.id),
    ]);
  }

  /**
   * Create timeout promise
   */
  private createTimeout(messageId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Message ${messageId} processing timeout after ${this.MESSAGE_TIMEOUT}ms`));
      }, this.MESSAGE_TIMEOUT);
    });
  }

  /**
   * Actually process the message
   */
  private async doProcessMessage(message: QueuedMessage): Promise<void> {
    // Check for active connection before processing
    const sock = await workerBaileysManager.getConnection(message.botId);

    if (!sock) {
      logger.warn(
        `No active connection for bot ${message.botId}, attempt ${message.attempts + 1}/3`
      );

      // Check if max retries reached
      if (message.attempts >= 2) {
        // Max retries (3 attempts total: 0, 1, 2)
        logger.error(
          `Max retry attempts reached for message ${message.id}, moving to dead letter queue`
        );
        await this.updateMessageStatus(message.id, 'failed');
        throw new Error(
          `No active connection for bot ${message.botId} after ${message.attempts + 1} attempts`
        );
      }

      // Return message to queue with delay for retry
      logger.info(`Returning message ${message.id} to queue for retry`);
      throw new Error(`No active connection for bot ${message.botId}, will retry`);
    }

    // Wait a bit to ensure connection is stable after reconnection
    // This helps avoid sending messages during unstable connection periods
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send message based on type
    let whatsappMessageId: string;

    logger.debug(`About to send ${message.request.type} message to ${message.request.to}`);

    try {
      switch (message.request.type) {
        case 'text':
          whatsappMessageId = await this.sendTextMessage(sock, message.request);
          break;
      case 'image':
        whatsappMessageId = await this.sendImageMessage(sock, message.request);
        break;
      case 'video':
        whatsappMessageId = await this.sendVideoMessage(sock, message.request);
        break;
      case 'document':
        whatsappMessageId = await this.sendDocumentMessage(sock, message.request);
        break;
      case 'audio':
        whatsappMessageId = await this.sendAudioMessage(sock, message.request);
        break;
      case 'interactive':
        whatsappMessageId = await this.sendInteractiveMessage(sock, message.request);
        break;
      default:
        throw new Error(`Unsupported message type: ${message.request.type}`);
      }
    } catch (error) {
      logger.error(`Error in switch statement while sending message:`, error);
      throw error;
    }

    // Update message status and metrics
    await this.updateMessageStatus(message.id, 'sent', whatsappMessageId);
    messagesSentTotal.inc({ type: message.request.type, status: 'sent' });
  }

  private async sendTextMessage(sock: WASocket, request: SendMessageRequest): Promise<string> {
    try {
      const jid = this.formatJID(request.to);
      logger.debug(`Sending text message to ${jid}`, { text: request.content.text });
      
      const result = await sock.sendMessage(jid, {
        text: request.content.text!,
      });
      
      logger.info(`Text message sent successfully to ${jid}`, { messageId: result?.key.id });
      return result?.key.id || '';
    } catch (error) {
      logger.error(`Error sending text message to ${request.to}:`, error);
      throw error;
    }
  }

  private async resolveMedia(content: any): Promise<{ buffer: Buffer; filename?: string; mimetype?: string }> {
    // Option 1: mediaId from database
    if (content.mediaId) {
      const mediaUrl = await this.getMediaUrl(content.mediaId);
      const mediaInfo = await this.getMediaInfo(content.mediaId);
      const response = await fetch(mediaUrl);
      if (!response.ok) throw new Error(`Failed to fetch media: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        filename: mediaInfo.filename,
        mimetype: mediaInfo.mimeType,
      };
    }

    // Option 2: external URL
    if (content.mediaUrl) {
      const response = await fetch(content.mediaUrl);
      if (!response.ok) throw new Error(`Failed to fetch media URL: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const filename = content.filename || content.mediaUrl.split('/').pop() || 'file';
      return {
        buffer: Buffer.from(arrayBuffer),
        filename,
      };
    }

    // Option 3: base64
    if (content.base64) {
      const buffer = Buffer.from(content.base64, 'base64');
      return {
        buffer,
        filename: content.filename || 'file',
      };
    }

    throw new Error('No media source provided (mediaId, mediaUrl, or base64)');
  }

  private async sendImageMessage(sock: WASocket, request: SendMessageRequest): Promise<string> {
    const jid = this.formatJID(request.to);
    const media = await this.resolveMedia(request.content);

    const result = await sock.sendMessage(jid, {
      image: media.buffer,
      caption: request.content.caption,
    });
    return result?.key.id || '';
  }

  private async sendVideoMessage(sock: WASocket, request: SendMessageRequest): Promise<string> {
    const jid = this.formatJID(request.to);
    const media = await this.resolveMedia(request.content);

    const result = await sock.sendMessage(jid, {
      video: media.buffer,
      caption: request.content.caption,
    });
    return result?.key.id || '';
  }

  private async sendDocumentMessage(sock: WASocket, request: SendMessageRequest): Promise<string> {
    const jid = this.formatJID(request.to);
    const media = await this.resolveMedia(request.content);

    const result = await sock.sendMessage(jid, {
      document: media.buffer,
      fileName: media.filename || 'document',
      mimetype: media.mimetype || 'application/octet-stream',
    });
    return result?.key.id || '';
  }

  private async sendAudioMessage(sock: WASocket, request: SendMessageRequest): Promise<string> {
    const jid = this.formatJID(request.to);
    const media = await this.resolveMedia(request.content);

    const result = await sock.sendMessage(jid, {
      audio: media.buffer,
      mimetype: media.mimetype || 'audio/mp4',
    });
    return result?.key.id || '';
  }

  private async sendInteractiveMessage(sock: WASocket, request: SendMessageRequest): Promise<string> {
    const jid = this.formatJID(request.to);

    const buttons =
      request.content.buttons?.map((btn, idx) => ({
        buttonId: btn.id || `btn_${idx}`,
        buttonText: { displayText: btn.title },
        type: 1,
      })) || [];

    const result = await sock.sendMessage(jid, {
      text: request.content.text!,
      footer: 'Powered by WhatsApp API Platform',
      buttons,
      headerType: 1,
    } as any);

    return result?.key.id || '';
  }

  private async updateMessageStatus(
    messageId: string,
    status: string,
    whatsappMessageId?: string
  ): Promise<void> {
    const updates: string[] = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [status];
    let paramIndex = 2;

    if (whatsappMessageId) {
      updates.push(`whatsapp_message_id = $${paramIndex++}`);
      values.push(whatsappMessageId);
    }

    values.push(messageId);

    await db.query(`UPDATE messages SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);
  }

  private async getMediaUrl(mediaId: string): Promise<string> {
    const result = await db.query('SELECT storage_url FROM media_files WHERE id = $1', [mediaId]);

    if (result.rows.length === 0) {
      throw new Error(`Media file not found: ${mediaId}`);
    }

    return result.rows[0].storage_url;
  }

  private async getMediaInfo(mediaId: string): Promise<{ filename: string; mimeType: string }> {
    const result = await db.query('SELECT filename, mime_type FROM media_files WHERE id = $1', [
      mediaId,
    ]);

    if (result.rows.length === 0) {
      throw new Error(`Media file not found: ${mediaId}`);
    }

    return {
      filename: result.rows[0].filename,
      mimeType: result.rows[0].mime_type,
    };
  }

  private formatJID(phoneNumber: string): string {
    // If already a JID (contains @), return as is
    if (phoneNumber.includes('@')) {
      return phoneNumber;
    }
    
    // Remove + and format to WhatsApp JID for phone numbers
    const cleaned = phoneNumber.replace(/\+/g, '');
    return `${cleaned}@s.whatsapp.net`;
  }

  /**
   * Handle graceful shutdown
   */
  async handleShutdown(): Promise<void> {
    logger.info('Starting graceful shutdown...');
    this.isShuttingDown = true;

    // Close health server
    if (this.healthServer) {
      this.healthServer.close(() => {
        logger.info('Health server closed');
      });
    }

    // Stop accepting new messages from queue
    // Note: queueService.stopConsuming() may need to be implemented
    logger.info('Stopping message consumption...');

    // Wait for active messages to complete
    const shutdownTimeout = config.worker.shutdownTimeout;
    const startTime = Date.now();

    logger.info(`Waiting for ${this.activeMessages.size} active messages to complete...`);

    while (this.activeMessages.size > 0 && Date.now() - startTime < shutdownTimeout) {
      logger.info(`Still processing ${this.activeMessages.size} messages...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (this.activeMessages.size > 0) {
      logger.warn(
        `Shutdown timeout reached: ${this.activeMessages.size} messages still processing`
      );
    } else {
      logger.info('All active messages completed');
    }

    // Shutdown Worker Baileys Manager
    try {
      await workerBaileysManager.shutdown();
      logger.info('Worker Baileys Manager shut down');
    } catch (error) {
      logger.error('Error shutting down Worker Baileys Manager:', error);
    }

    // Close queue connection
    try {
      await queueService.close();
      logger.info('Queue connection closed');
    } catch (error) {
      logger.error('Error closing queue connection:', error);
    }

    // Unsubscribe from Redis PubSub and disconnect
    try {
      await redisPubSubService.disconnect();
      logger.info('Redis PubSub disconnected');
    } catch (error) {
      logger.error('Error disconnecting Redis PubSub:', error);
    }

    // Disconnect from Redis
    try {
      await redisStorage.disconnect();
      await lockService.disconnect();
      await cacheService.disconnect();
      logger.info('Disconnected from Redis');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }

    // Close database connection
    try {
      await db.close();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  }
}

export const messageWorker = new MessageWorker();

// Start worker if this file is run directly
if (require.main === module) {
  logger.info('Message worker module loaded as main, starting worker...');
  messageWorker.start().catch((error) => {
    logger.error('Failed to start message worker:', error);
    process.exit(1);
  });
}
