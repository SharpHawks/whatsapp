import makeWASocket, {
  DisconnectReason,
  WASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import path from 'path';
import os from 'os';
import { db } from '../database';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';
import { connectionStatusService } from './connection-status.service';

interface ConnectionInfo {
  botId: string;
  qrCode?: string;
  status: 'connecting' | 'qr_required' | 'connected' | 'disconnected';
  phoneNumber?: string;
}

export class BaileysConnectionManager {
  private connections: Map<string, WASocket> = new Map();
  private connectionStatus: Map<string, string> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  async createConnection(botId: string): Promise<ConnectionInfo> {
    try {
      // Check if connection already exists in this process
      if (this.connections.has(botId)) {
        const status = this.connectionStatus.get(botId) || 'disconnected';
        return {
          botId,
          status: status as any,
        };
      }

      // Check for existing connection in other processes
      const existingConnection = await connectionStatusService.getConnectionStatus(botId);
      if (
        existingConnection &&
        existingConnection.status === 'connected' &&
        existingConnection.processId !== process.pid
      ) {
        logger.warn(
          `Bot ${botId} already has an active connection in process ${existingConnection.processId} on ${existingConnection.hostname}`
        );
        // Continue anyway - the distributed lock in worker will prevent actual duplicates
      }

      logger.info(`Creating Baileys connection for bot: ${botId}`);

      // Set up auth state
      const sessionPath = path.join(config.baileys.sessionPath, botId);
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      // Get latest Baileys version
      const { version } = await fetchLatestBaileysVersion();

      // Create socket
      const sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger as any),
        },
        printQRInTerminal: false,
        logger: logger as any,
        browser: ['WhatsApp API Platform', 'Chrome', '1.0.0'],
      });

      // Store connection
      this.connections.set(botId, sock);
      this.connectionStatus.set(botId, 'connecting');

      // Set up event handlers
      this.setupEventHandlers(botId, sock, saveCreds);

      return {
        botId,
        status: 'connecting',
      };
    } catch (error) {
      logger.error(`Failed to create connection for bot ${botId}:`, error);
      throw new AppError(
        ErrorCode.BAILEYS_CONNECTION_ERROR,
        'Failed to create WhatsApp connection',
        500,
        error
      );
    }
  }

  private setupEventHandlers(
    botId: string,
    sock: WASocket,
    saveCreds: () => Promise<void>
  ) {
    // Connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      logger.debug(`Connection update for bot ${botId}:`, { connection, hasQR: !!qr, hasError: !!lastDisconnect?.error });

      if (qr) {
        logger.info(`QR code generated for bot: ${botId}`);
        
        // Store raw QR string with timestamp in database (frontend will generate the image)
        await this.updateBotQRCode(botId, qr);
        this.connectionStatus.set(botId, 'qr_required');
        logger.debug(`QR code stored in database for bot: ${botId}`);
        
        // Emit QR code via WebSocket with error handling
        try {
          const { socketService } = await import('./socket.service');
          const userId = await this.getBotUserId(botId);
          if (userId) {
            socketService.emitBotQRCode(userId, botId, qr);
            logger.info(`QR code emitted via WebSocket for bot ${botId} to user ${userId}`);
          } else {
            logger.warn(`Cannot emit QR code via WebSocket: user not found for bot ${botId}`);
          }
        } catch (error) {
          logger.error(`Failed to emit QR code via WebSocket for bot ${botId}:`, error);
          // QR is still in DB, HTTP polling will work as fallback
          logger.info(`QR code available via HTTP polling fallback for bot ${botId}`);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        logger.info(`Connection closed for bot ${botId}, status code: ${statusCode}, should reconnect: ${shouldReconnect}`);

        if (shouldReconnect) {
          const attempts = this.reconnectAttempts.get(botId) || 0;
          if (attempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts.set(botId, attempts + 1);
            // Use shorter delay for first reconnect (after pairing)
            const delay = attempts === 0 ? 1000 : Math.min(1000 * Math.pow(2, attempts), 30000);
            logger.info(`Reconnecting bot ${botId} in ${delay}ms (attempt ${attempts + 1})`);
            
            // Clean up old connection
            this.connections.delete(botId);
            
            setTimeout(() => this.createConnection(botId), delay);
          } else {
            logger.error(`Max reconnection attempts reached for bot: ${botId}`);
            this.connectionStatus.set(botId, 'disconnected');
            await this.updateBotStatus(botId, 'disconnected');
          }
        } else {
          logger.info(`Bot ${botId} logged out`);
          this.connections.delete(botId);
          this.connectionStatus.set(botId, 'disconnected');
          await this.updateBotStatus(botId, 'disconnected');
        }
      } else if (connection === 'open') {
        try {
          logger.info(`Bot ${botId} connected successfully`);
          this.connectionStatus.set(botId, 'connected');
          this.reconnectAttempts.set(botId, 0);
          
          // Clear QR code from database when bot successfully connects
          await this.clearBotQRCode(botId);
          logger.debug(`QR code cleared from database for bot ${botId}`);
          
          await this.updateBotStatus(botId, 'connected');
          
          // Get phone number
          const phoneNumber = sock.user?.id?.split(':')[0];
          if (phoneNumber) {
            await this.updateBotPhoneNumber(botId, phoneNumber);
            logger.info(`Bot ${botId} phone number: ${phoneNumber}`);
          }

          // Emit connection status via WebSocket
          try {
            const { socketService } = await import('./socket.service');
            const userId = await this.getBotUserId(botId);
            if (userId) {
              socketService.emitBotStatus(userId, botId, 'connected', phoneNumber);
              logger.info(`Emitted connection status to user ${userId} for bot ${botId}`);
            } else {
              logger.warn(`Cannot emit connection status: user not found for bot ${botId}`);
            }
          } catch (socketError) {
            logger.error(`Failed to emit connection status via WebSocket for bot ${botId}:`, socketError);
          }
        } catch (error) {
          logger.error(`Error handling bot connection for ${botId}:`, error);
        }
      }
    });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    sock.ev.on('messages.upsert', async (m) => {
      const { messageHandlerService } = await import('./message-handler.service');
      for (const msg of m.messages) {
        if (!msg.key.fromMe) {
          await messageHandlerService.handleIncomingMessage(botId, msg);
        }
      }
    });

    // Handle message status updates
    sock.ev.on('messages.update', async (updates) => {
      const { messageHandlerService } = await import('./message-handler.service');
      await messageHandlerService.handleMessageStatusUpdate(botId, updates);
    });
  }

  async getConnection(botId: string): Promise<WASocket | null> {
    return this.connections.get(botId) || null;
  }

  async disconnectBot(botId: string): Promise<void> {
    const sock = this.connections.get(botId);
    if (sock) {
      await sock.logout();
      this.connections.delete(botId);
      this.connectionStatus.delete(botId);
      this.reconnectAttempts.delete(botId);
      await this.updateBotStatus(botId, 'disconnected');
      logger.info(`Bot ${botId} disconnected`);
    }
  }

  async getQRCode(botId: string): Promise<string | null> {
    const result = await db.query(
      'SELECT qr_code FROM bots WHERE id = $1',
      [botId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].qr_code;
  }

  async isConnected(botId: string): Promise<boolean> {
    const status = this.connectionStatus.get(botId);
    return status === 'connected';
  }

  private async updateBotStatus(botId: string, status: string): Promise<void> {
    await connectionStatusService.updateConnectionStatus(
      botId,
      status as any,
      {
        processId: process.pid,
        hostname: os.hostname(),
      }
    );
  }

  private async updateBotQRCode(botId: string, qrCode: string): Promise<void> {
    try {
      await db.query(
        'UPDATE bots SET qr_code = $1, qr_generated_at = NOW(), connection_status = $2 WHERE id = $3',
        [qrCode, 'qr_required', botId]
      );
      logger.debug(`Updated QR code with timestamp for bot ${botId}`);
    } catch (error) {
      logger.error(`Failed to update QR code in database for bot ${botId}:`, error);
      throw error;
    }
  }

  private async clearBotQRCode(botId: string): Promise<void> {
    try {
      await db.query(
        'UPDATE bots SET qr_code = NULL, qr_generated_at = NULL WHERE id = $1',
        [botId]
      );
      logger.debug(`Cleared QR code from database for bot ${botId}`);
    } catch (error) {
      logger.error(`Failed to clear QR code from database for bot ${botId}:`, error);
      throw error;
    }
  }

  private async updateBotPhoneNumber(botId: string, phoneNumber: string): Promise<void> {
    await db.query(
      'UPDATE bots SET phone_number = $1 WHERE id = $2',
      [phoneNumber, botId]
    );
  }

  private async getBotUserId(botId: string): Promise<string | null> {
    const result = await db.query(
      'SELECT user_id FROM bots WHERE id = $1',
      [botId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].user_id;
  }

  // Health check for all connections
  async healthCheck(): Promise<{ botId: string; status: string }[]> {
    const results: { botId: string; status: string }[] = [];
    
    for (const [botId, status] of this.connectionStatus.entries()) {
      results.push({ botId, status });
    }

    return results;
  }

  // Restore connections for all active bots
  async restoreConnections(): Promise<void> {
    try {
      logger.info('Restoring Baileys connections for active bots...');
      
      const result = await db.query(
        `SELECT id FROM bots 
         WHERE is_active = true 
         AND connection_status IN ('connected', 'qr_required', 'connecting')`
      );

      const bots = result.rows;
      logger.info(`Found ${bots.length} active bots to restore`);

      for (const bot of bots) {
        try {
          await this.createConnection(bot.id);
          logger.info(`Restored connection for bot: ${bot.id}`);
        } catch (error) {
          logger.error(`Failed to restore connection for bot ${bot.id}:`, error);
        }
      }

      logger.info('Finished restoring connections');
    } catch (error) {
      logger.error('Error restoring connections:', error);
    }
  }
}

export const baileysManager = new BaileysConnectionManager();
