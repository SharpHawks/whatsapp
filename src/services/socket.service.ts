import { Server as HTTPServer } from 'http';
import { Server, Socket, ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
}

class SocketService {
  private io: Server | null = null;
  private userSockets: Map<string, Set<string>> = new Map();
  private redisPubClient: ReturnType<typeof createClient> | null = null;
  private redisSubClient: ReturnType<typeof createClient> | null = null;

  async initialize(httpServer: HTTPServer): Promise<void> {
    const serverOptions: Partial<ServerOptions> = {
      path: config.socket.path,
      cors: this.getCorsOptions(),
      pingTimeout: 20000,
      pingInterval: 25000,
    };

    if (config.socket.useRedisAdapter) {
      try {
        const pubClient = createClient({
          socket: { host: config.redis.host, port: config.redis.port },
          password: config.redis.password || undefined,
        });
        const subClient = pubClient.duplicate();

        await Promise.all([pubClient.connect(), subClient.connect()]);

        pubClient.on('error', (err) => logger.error('Socket.IO Redis pub client error:', err));
        subClient.on('error', (err) => logger.error('Socket.IO Redis sub client error:', err));

        (serverOptions as ServerOptions).adapter = createAdapter(pubClient, subClient) as ServerOptions['adapter'];
        this.redisPubClient = pubClient;
        this.redisSubClient = subClient;

        logger.info('Socket.IO Redis adapter enabled (multi-instance support)');
      } catch (error) {
        logger.error('Failed to initialize Socket.IO Redis adapter:', error);
        throw error;
      }
    }

    this.io = new Server(httpServer, serverOptions);

    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        const decoded = jwt.verify(token, config.jwt.secret) as {
          userId: string;
          email?: string;
        };
        socket.userId = decoded.userId;
        socket.email = decoded.email;
        next();
      } catch {
        next(new Error('Authentication error: Invalid token'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId!;
      logger.info(`Socket connected: ${socket.id} for user ${userId}`);

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      socket.join(`user:${userId}`);

      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
          userSocketSet.delete(socket.id);
          if (userSocketSet.size === 0) {
            this.userSockets.delete(userId);
          }
        }
      });

      socket.emit('connected', { message: 'Connected to WhatsApp API' });
    });

    logger.info(`Socket.IO initialized (path: ${config.socket.path})`);
  }

  private getCorsOptions(): { origin: string | string[]; credentials: boolean } {
    const isProd = config.server.env === 'production';
    const origins = config.socket.corsOrigins;

    if (isProd && origins.length > 0) {
      return { origin: origins, credentials: true };
    }

    return {
      origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],
      credentials: true,
    };
  }

  async close(): Promise<void> {
    if (this.io) {
      this.io.close();
      this.io = null;
    }
    if (this.redisPubClient) {
      await this.redisPubClient.quit();
      this.redisPubClient = null;
    }
    if (this.redisSubClient) {
      await this.redisSubClient.quit();
      this.redisSubClient = null;
    }
    this.userSockets.clear();
    logger.info('Socket.IO closed');
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
      logger.debug(`Emitted ${event} to user ${userId}`);
    }
  }

  emitToAll(event: string, data: unknown): void {
    if (this.io) {
      this.io.emit(event, data);
      logger.debug(`Emitted ${event} to all clients`);
    }
  }

  emitBotStatus(userId: string, botId: string, status: string, phoneNumber?: string): void {
    this.emitToUser(userId, 'bot:status', {
      botId,
      status,
      phoneNumber,
      timestamp: new Date().toISOString(),
    });
  }

  emitBotQRCode(userId: string, botId: string, qrCode: string): void {
    this.emitToUser(userId, 'bot:qr', {
      botId,
      qrCode,
      timestamp: new Date().toISOString(),
    });
  }

  emitNewMessage(userId: string, botId: string, message: unknown): void {
    this.emitToUser(userId, 'message:new', {
      botId,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  emitMessageStatus(userId: string, messageId: string, status: string): void {
    this.emitToUser(userId, 'message:status', {
      messageId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  emitBalanceUpdate(userId: string, balance: number, change: number): void {
    this.emitToUser(userId, 'balance:updated', {
      userId,
      balance,
      change,
      timestamp: new Date().toISOString(),
    });
  }

  emitLowBalanceWarning(userId: string, balance: number, threshold: number): void {
    this.emitToUser(userId, 'balance:low', {
      balance,
      threshold,
      timestamp: new Date().toISOString(),
    });
  }

  emitWebhookDelivery(userId: string, botId: string, success: boolean, url: string): void {
    this.emitToUser(userId, 'webhook:delivery', {
      botId,
      success,
      url,
      timestamp: new Date().toISOString(),
    });
  }

  emitQuotaUpdate(userId: string, data: {
    messagesUsed: number;
    messagesRemaining: number;
    messageQuota: number | null;
    cost: number;
    billingMode: 'subscription' | 'pay-per-message';
    botLimit: number | null;
    currentBots: number;
  }): void {
    this.emitToUser(userId, 'quota:updated', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  emitApiKeyGenerated(userId: string, botId: string, apiKey: string): void {
    this.emitToUser(userId, 'bot:apikey:generated', {
      botId,
      key: apiKey,
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      timestamp: new Date().toISOString(),
    });
    logger.info(`Emitted API key generated for bot ${botId} to user ${userId}`);
  }

  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }
}

export const socketService = new SocketService();
