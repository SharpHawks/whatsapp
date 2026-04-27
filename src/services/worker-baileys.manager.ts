import makeWASocket, {
  DisconnectReason,
  WASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  AuthenticationState,
} from '@whiskeysockets/baileys';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { db } from '../database';
import { config } from '../config';
import { logger } from '../utils/logger';
import { lockService } from './lock.service';
import { redisPubSubService } from './redis-pubsub.service';
import { redisStorage } from '../utils/redis-storage';
import { metricsService } from './metrics.service';
import { alertService } from './alert.service';
import { Bot } from '../types';

interface ConnectionInfo {
  botId: string;
  socket: WASocket;
  status: 'connecting' | 'connected' | 'disconnected';
  lastHealthCheck: Date;
  lastValidated: Date;
  socketValid: boolean;
  processId: number;
  hostname: string;
  reconnectAttempts: number;
}

interface ConnectionHealth {
  botId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastMessageSent?: Date;
  lastMessageReceived?: Date;
  lastQRGenerated?: Date;
  reconnectAttempts: number;
  errors: Array<{
    timestamp: Date;
    error: string;
  }>;
  uptime: number; // milliseconds
  connectedAt?: Date;
}

export class WorkerBaileysManager {
  private connections: Map<string, ConnectionInfo> = new Map();
  private connectionHealth: Map<string, ConnectionHealth> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly MAX_BACKOFF_DELAY = 30000; // 30 seconds
  private readonly workerId: string = `${os.hostname()}-${process.pid}`;

  /**
   * Get an active connection for a bot
   * Performs multi-level validation to ensure connection is truly usable
   */
  async getConnection(botId: string): Promise<WASocket | null> {
    logger.debug(`Checking connection for bot ${botId}`);
    
    // Synchronize connection state before validation
    await this.syncConnectionState(botId);
    
    // Level 1: Check if connection exists in map
    const connInfo = this.connections.get(botId);
    
    if (!connInfo) {
      logger.debug(`No connection found in map for bot ${botId}`);
      return null;
    }

    // Level 2: Check status field
    if (connInfo.status !== 'connected') {
      logger.warn(`Connection for bot ${botId} has status: ${connInfo.status}`);
      return null;
    }

    // Level 3: Validate socket is usable (authentication + required methods)
    const isValid = this.isSocketValid(connInfo.socket);
    
    if (!isValid) {
      logger.error(`Socket validation failed for bot ${botId} despite connected status - cleaning up inconsistent state`);
      
      // Update validation cache
      this.updateConnectionInfo(botId, {
        lastValidated: new Date(),
        socketValid: false,
      });
      
      // Determine if socket exists but is just not authenticated
      if (connInfo.socket && !connInfo.socket.user) {
        // Socket exists but not authenticated - update to connecting
        logger.warn(`Socket for bot ${botId} exists but is not authenticated - updating status to connecting`);
        this.updateConnectionInfo(botId, { status: 'connecting' });
        await this.updateConnectionStatus(botId, 'connecting');
      } else {
        // Socket is null or invalid - clean up completely
        logger.error(`Socket for bot ${botId} is null or invalid - cleaning up connection`);
        this.connections.delete(botId);
        await this.updateConnectionStatus(botId, 'disconnected');
      }
      
      return null;
    }

    // All checks passed - socket is valid and connected
    // Update validation cache
    this.updateConnectionInfo(botId, {
      lastValidated: new Date(),
      socketValid: true,
    });
    
    logger.debug(`Connection validation passed for bot ${botId} - socket is authenticated and valid`);
    return connInfo.socket;
  }

  /**
   * Get groups for a bot
   */
  async getGroups(botId: string): Promise<Array<{
    id: string;
    name: string;
    participantCount: number;
    isAdmin: boolean;
  }>> {
    try {
      logger.debug(`Getting groups for bot ${botId}`);

      // Get socket connection
      const socket = await this.getConnection(botId);
      
      if (!socket) {
        // Check if bot exists in database
        const exists = await this.botExists(botId);
        
        if (!exists) {
          const error = new Error(`Bot with ID ${botId} not found. Please check the bot ID and try again.`);
          logger.error(`Cannot get groups: bot ${botId} does not exist in database`);
          throw error;
        }

        // Bot exists, check its current status
        const currentStatus = await this.getBotStatus(botId);
        
        logger.error(`Cannot get groups for bot ${botId}: connection not available`, {
          botId,
          currentStatus,
          hasConnectionInfo: this.connections.has(botId),
        });

        // Provide helpful error message based on status
        let errorMessage = 'Bot is not connected. ';
        
        if (currentStatus === 'qr_required') {
          errorMessage += 'Please scan the QR code to authenticate the bot.';
        } else if (currentStatus === 'connecting') {
          errorMessage += 'Bot is currently connecting. Please wait a moment and try again.';
        } else if (currentStatus === 'disconnected') {
          errorMessage += 'Bot is disconnected. Please reconnect the bot first.';
        } else {
          errorMessage += `Current status: ${currentStatus || 'unknown'}. Please ensure the bot is connected.`;
        }

        const error = new Error(errorMessage);
        throw error;
      }

      // Fetch all participating groups
      const groups = await socket.groupFetchAllParticipating();
      
      logger.debug(`Fetched ${Object.keys(groups).length} groups for bot ${botId}`);

      // Format group data
      const formattedGroups = Object.values(groups).map((group: any) => {
        // Get bot's phone number to check admin status
        const botPhoneNumber = socket.user?.id?.split(':')[0];
        const isAdmin = group.participants?.some(
          (p: any) => p.id?.split(':')[0] === botPhoneNumber && p.admin
        ) || false;

        return {
          id: group.id,
          name: group.subject || 'Unnamed Group',
          participantCount: group.participants?.length || 0,
          isAdmin,
        };
      });

      logger.info(`Retrieved ${formattedGroups.length} groups for bot ${botId}`);
      return formattedGroups;
    } catch (error) {
      logger.error(`Error getting groups for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Close a specific connection
   */
  async closeConnection(botId: string): Promise<void> {
    const existingConnection = this.connections.get(botId);
    
    if (!existingConnection) {
      logger.debug(`No connection to close for bot ${botId}`);
      return;
    }

    try {
      logger.info(`Closing connection for bot ${botId}`);
      
      // Save session before closing
      await this.saveSession(botId, existingConnection.socket);
      
      // Logout from WhatsApp
      await existingConnection.socket.logout();
      
      // Update database status
      await this.updateConnectionStatus(botId, 'disconnected');
      
      // Remove from connections map
      this.connections.delete(botId);
      
      logger.info(`Connection closed for bot ${botId}`);
    } catch (error) {
      logger.error(`Error closing connection for bot ${botId}:`, error);
      // Still remove from map even if there was an error
      this.connections.delete(botId);
    }
  }

  /**
   * Close all connections
   */
  async closeAllConnections(): Promise<void> {
    logger.info(`Closing all connections (${this.connections.size} total)`);
    
    const closePromises = Array.from(this.connections.keys()).map(botId =>
      this.closeConnection(botId)
    );
    
    await Promise.all(closePromises);
    
    logger.info('All connections closed');
  }

  /**
   * Get all held connections
   */
  getConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get worker health status
   */
  async getWorkerHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    connections: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    healthyConnections: number;
    degradedConnections: number;
    unhealthyConnections: number;
  }> {
    const uptime = process.uptime() * 1000; // Convert to milliseconds
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const usedMemory = memUsage.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // Count connection health statuses
    const healthMetrics = Array.from(this.connectionHealth.values());
    const healthyCount = healthMetrics.filter(h => h.status === 'healthy').length;
    const degradedCount = healthMetrics.filter(h => h.status === 'degraded').length;
    const unhealthyCount = healthMetrics.filter(h => h.status === 'unhealthy').length;

    // Determine overall worker health
    let workerStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0 || memoryPercentage > 90) {
      workerStatus = 'unhealthy';
      
      // Alert on high memory usage
      if (memoryPercentage > 90) {
        alertService.alertHighMemoryUsage(
          memoryPercentage,
          Math.round(usedMemory / 1024 / 1024),
          Math.round(totalMemory / 1024 / 1024)
        );
      }

      // Alert on multiple disconnections
      const totalConnections = this.connections.size + unhealthyCount;
      if (unhealthyCount > 0 && totalConnections > 0) {
        const disconnectionRate = (unhealthyCount / totalConnections) * 100;
        if (disconnectionRate > 50) {
          alertService.alertMultipleDisconnections(unhealthyCount, totalConnections);
        }
      }
    } else if (degradedCount > 0 || memoryPercentage > 75) {
      workerStatus = 'degraded';

      // Alert on high memory usage (warning level)
      if (memoryPercentage > 75) {
        alertService.alertHighMemoryUsage(
          memoryPercentage,
          Math.round(usedMemory / 1024 / 1024),
          Math.round(totalMemory / 1024 / 1024)
        );
      }
    }

    return {
      status: workerStatus,
      uptime,
      connections: this.connections.size,
      memory: {
        used: Math.round(usedMemory / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        percentage: Math.round(memoryPercentage * 100) / 100,
      },
      healthyConnections: healthyCount,
      degradedConnections: degradedCount,
      unhealthyConnections: unhealthyCount,
    };
  }

  /**
   * Check if manager is shutting down
   */
  isShuttingDownFlag(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Set shutdown flag
   */
  setShuttingDown(value: boolean): void {
    this.isShuttingDown = value;
  }

  /**
   * Validate if a socket is usable for operations
   * Checks authentication state and required methods
   */
  private isSocketValid(socket: WASocket | null | undefined): boolean {
    try {
      // Check if socket exists
      if (!socket) {
        logger.debug('Socket validation failed: socket is null or undefined');
        return false;
      }

      // Check if socket is authenticated (has user info)
      if (!socket.user) {
        logger.debug('Socket validation failed: not authenticated (no user info)');
        return false;
      }

      // Check if socket has required methods
      if (typeof socket.groupFetchAllParticipating !== 'function') {
        logger.error('Socket validation failed: missing required method groupFetchAllParticipating');
        return false;
      }

      // All checks passed
      logger.debug('Socket validation passed: socket is authenticated and has required methods');
      return true;
    } catch (error) {
      logger.error('Error during socket validation:', error);
      return false;
    }
  }

  /**
   * Update connection info
   */
  private updateConnectionInfo(botId: string, updates: Partial<ConnectionInfo>): void {
    const existingInfo = this.connections.get(botId);
    if (existingInfo) {
      this.connections.set(botId, { ...existingInfo, ...updates });
    }
  }

  /**
   * Update connection status in database and Redis
   */
  private async updateConnectionStatus(
    botId: string,
    status: string
  ): Promise<void> {
    try {
      await db.query(
        `UPDATE bots 
         SET connection_status = $1,
             connection_process_id = $2,
             connection_hostname = $3,
             connection_updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [status, process.pid, os.hostname(), botId]
      );

      logger.debug(`Updated connection status for bot ${botId}: ${status}`);

      // Store connection state in Redis
      await this.saveConnectionState(botId, status as any);

      // Emit socket event if socket service is available
      try {
        const { socketService } = await import('./socket.service');
        const userId = await this.getBotUserId(botId);
        if (userId) {
          socketService.emitBotStatus(userId, botId, status as any);
        }
      } catch (error) {
        logger.debug('Socket service not available or error emitting event:', error);
      }
    } catch (error) {
      logger.error(`Error updating connection status for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Save connection state to Redis
   */
  private async saveConnectionState(
    botId: string,
    status: 'connected' | 'connecting' | 'disconnected'
  ): Promise<void> {
    try {
      const health = this.connectionHealth.get(botId);
      
      // Get phone number from database
      const result = await db.query(
        'SELECT phone_number FROM bots WHERE id = $1',
        [botId]
      );
      const phoneNumber = result.rows[0]?.phone_number;

      const state: import('../utils/redis-storage').ConnectionState = {
        botId,
        status,
        lastSeen: new Date(),
        phoneNumber,
        reconnectAttempts: health?.reconnectAttempts || 0,
      };

      await redisStorage.storeConnectionState(botId, state);
      logger.debug(`Saved connection state to Redis for bot ${botId}`);
    } catch (error) {
      logger.error(`Error saving connection state for bot ${botId}:`, error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Load connection state from Redis
   */
  private async loadConnectionState(botId: string): Promise<import('../utils/redis-storage').ConnectionState | null> {
    try {
      const state = await redisStorage.getConnectionState(botId);
      if (state) {
        logger.debug(`Loaded connection state from Redis for bot ${botId}`);
      }
      return state;
    } catch (error) {
      logger.error(`Error loading connection state for bot ${botId}:`, error);
      return null;
    }
  }

  /**
   * Get bot's user ID
   */
  private async getBotUserId(botId: string): Promise<string | null> {
    try {
      const result = await db.query(
        'SELECT user_id FROM bots WHERE id = $1',
        [botId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].user_id;
    } catch (error) {
      logger.error(`Error getting user ID for bot ${botId}:`, error);
      return null;
    }
  }

  /**
   * Check if bot exists in database
   */
  private async botExists(botId: string): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT id FROM bots WHERE id = $1',
        [botId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Error checking if bot exists ${botId}:`, error);
      return false;
    }
  }

  /**
   * Get current bot status from database
   */
  private async getBotStatus(botId: string): Promise<string | null> {
    try {
      const result = await db.query(
        'SELECT connection_status FROM bots WHERE id = $1',
        [botId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].connection_status;
    } catch (error) {
      logger.error(`Error getting bot status for ${botId}:`, error);
      return null;
    }
  }

  /**
   * Synchronize connection state between memory and database
   * Detects and resolves mismatches based on actual socket validity
   */
  private async syncConnectionState(botId: string): Promise<void> {
    try {
      logger.debug(`Synchronizing connection state for bot ${botId}`);

      // Get in-memory connection info
      const connInfo = this.connections.get(botId);
      const memoryStatus = connInfo?.status || 'disconnected';

      // Get database status
      const dbStatus = await this.getBotStatus(botId);

      // Check for mismatch
      if (memoryStatus !== dbStatus) {
        logger.warn(`Connection state mismatch detected for bot ${botId}`, {
          memoryStatus,
          dbStatus,
          hasConnection: !!connInfo,
        });

        // Determine actual state based on socket validation
        let actualStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';

        if (connInfo && connInfo.socket) {
          // Socket exists, validate it
          if (this.isSocketValid(connInfo.socket)) {
            actualStatus = 'connected';
          } else if (connInfo.socket.user) {
            // Socket exists but not fully valid
            actualStatus = 'connecting';
          } else {
            actualStatus = 'disconnected';
          }
        }

        logger.info(`Resolving state mismatch for bot ${botId}`, {
          memoryStatus,
          dbStatus,
          actualStatus,
        });

        // Update both memory and database to match actual state
        if (connInfo) {
          this.updateConnectionInfo(botId, { status: actualStatus });
        }

        await this.updateConnectionStatus(botId, actualStatus);

        logger.info(`Connection state synchronized for bot ${botId}: ${actualStatus}`);
      } else {
        logger.debug(`Connection state is consistent for bot ${botId}: ${memoryStatus}`);
      }
    } catch (error) {
      logger.error(`Error synchronizing connection state for bot ${botId}:`, error);
      // Don't throw - this is a best-effort operation
    }
  }

  /**
   * Start Redis PubSub event listener
   */
  async startEventListener(): Promise<void> {
    try {
      logger.info('Starting Redis PubSub event listener');

      await redisPubSubService.subscribeBotEvents({
        onBotConnect: async (botId: string) => {
          logger.info(`Received bot:connect event for bot ${botId}`);
          try {
            await this.createConnection(botId);
          } catch (error) {
            logger.error(`Failed to create connection for bot ${botId}:`, error);
            // Update status to disconnected on failure
            await this.updateConnectionStatus(botId, 'disconnected');
          }
        },
        onBotDisconnect: async (botId: string) => {
          logger.info(`Received bot:disconnect event for bot ${botId}`);
          try {
            await this.closeConnection(botId);
          } catch (error) {
            logger.error(`Failed to close connection for bot ${botId}:`, error);
          }
        },
      });

      logger.info('Redis PubSub event listener started');
    } catch (error) {
      logger.error('Error starting Redis PubSub event listener:', error);
      throw error;
    }
  }

  /**
   * Initialize the manager and load all active bots
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Worker Baileys Manager');

      // Publish worker:started event
      try {
        await redisPubSubService.publishWorkerStarted(this.workerId);
        logger.info(`Published worker:started event for ${this.workerId}`);
      } catch (error) {
        logger.error('Error publishing worker:started event:', error);
      }

      // Start event listener first
      await this.startEventListener();

      // Start heartbeat mechanism
      this.startHeartbeat();

      // Start periodic metrics logging
      this.startMetricsLogging();

      // Load active bots from database
      const bots = await this.loadActiveBots();
      logger.info(`Found ${bots.length} connected bots to restore`);

      // Restore connections in parallel using Promise.all
      const restorationPromises = bots.map(async (bot) => {
        try {
          // Try to load previous state from Redis
          const previousState = await this.loadConnectionState(bot.id);
          if (previousState) {
            logger.info(`Found previous state for bot ${bot.id}:`, {
              status: previousState.status,
              reconnectAttempts: previousState.reconnectAttempts,
            });
          }

          await this.createConnection(bot.id);
          logger.info(`Successfully restored connection for bot ${bot.id}`);
          return { botId: bot.id, success: true };
        } catch (error) {
          logger.error(`Failed to restore connection for bot ${bot.id}:`, error);
          
          // Update status to disconnected on failure
          try {
            await this.updateConnectionStatus(bot.id, 'disconnected');
          } catch (updateError) {
            logger.error(`Failed to update status for bot ${bot.id}:`, updateError);
          }
          
          return { botId: bot.id, success: false, error };
        }
      });

      // Wait for all restoration attempts to complete
      const results = await Promise.all(restorationPromises);
      
      // Log summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      logger.info(`Connection restoration complete: ${successful} successful, ${failed} failed`);
      
      if (failed > 0) {
        const failedBotIds = results.filter(r => !r.success).map(r => r.botId);
        logger.warn(`Failed to restore connections for bots: ${failedBotIds.join(', ')}`);
      }

      // Publish worker:ready event with connection count
      const connectionCount = this.connections.size;
      try {
        await redisPubSubService.publishWorkerReady(this.workerId, connectionCount);
        logger.info(`Published worker:ready event for ${this.workerId} with ${connectionCount} connections`);
      } catch (error) {
        logger.error('Error publishing worker:ready event:', error);
      }

      logger.info('Worker Baileys Manager initialized successfully');
    } catch (error) {
      logger.error('Error initializing Worker Baileys Manager:', error);
      throw error;
    }
  }

  /**
   * Load all active bots from database that should be connected.
   * Restores ALL active bots — previous graceful shutdown sets status to 'disconnected'
   * but session files on disk remain valid, so reconnection happens automatically without QR.
   */
  async loadActiveBots(): Promise<Bot[]> {
    try {
      const result = await db.query<Bot>(
        `SELECT * FROM bots
         WHERE is_active = true
         ORDER BY created_at ASC`
      );

      return result.rows;
    } catch (error) {
      logger.error('Error loading active bots:', error);
      throw error;
    }
  }

  /**
   * Create a new connection for a bot
   */
  async createConnection(botId: string): Promise<WASocket> {
    // Check if connection already exists
    if (this.connections.has(botId)) {
      logger.warn(`Connection already exists for bot ${botId}`);
      const connInfo = this.connections.get(botId)!;
      return connInfo.socket;
    }

    // Acquire distributed lock to prevent duplicate connections
    const lockKey = `bot:connection:${botId}`;
    const lockId = await lockService.acquireLock(lockKey, config.lock.ttl);

    if (!lockId) {
      const error = new Error(`Could not acquire lock for bot ${botId}`);
      logger.error(error.message);
      throw error;
    }

    try {
      logger.info(`Creating connection for bot ${botId} in worker process`);

      // Restore session from database/filesystem
      const authState = await this.restoreSession(botId);

      // Get latest Baileys version
      const { version } = await fetchLatestBaileysVersion();

      // Create Baileys socket
      const socket = makeWASocket({
        version,
        auth: {
          creds: authState.state.creds,
          keys: makeCacheableSignalKeyStore(authState.state.keys, undefined as any),
        },
        printQRInTerminal: false,
        // Don't pass our Winston logger to Baileys - it expects Pino logger format
        // logger: undefined,
        browser: ['WhatsApp API Worker', 'Chrome', '1.0.0'],
      });

      // Store connection info
      const connInfo: ConnectionInfo = {
        botId,
        socket,
        status: 'connecting',
        lastHealthCheck: new Date(),
        lastValidated: new Date(),
        socketValid: false, // Will be validated when connection opens
        processId: process.pid,
        hostname: os.hostname(),
        reconnectAttempts: 0,
      };

      this.connections.set(botId, connInfo);

      // Initialize health tracking
      this.initializeConnectionHealth(botId);

      // Set up event handlers
      this.setupEventHandlers(botId, socket, authState.saveCreds);

      // Update database
      await this.updateConnectionStatus(botId, 'connecting');

      // Start health check if not already running
      if (!this.healthCheckInterval) {
        this.startHealthCheck();
      }

      logger.info(`Connection created for bot ${botId}`, {
        processId: process.pid,
        hostname: os.hostname(),
      });

      return socket;
    } catch (error) {
      logger.error(`Error creating connection for bot ${botId}:`, error);
      throw error;
    } finally {
      // Release lock after connection is established or failed
      await lockService.releaseLock(lockKey, lockId);
    }
  }

  /**
   * Restore session from filesystem
   */
  private async restoreSession(botId: string): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }> {
    try {
      const sessionPath = path.join(config.baileys.sessionPath, botId);
      const authState = await useMultiFileAuthState(sessionPath);

      logger.debug(`Session restored for bot ${botId} from ${sessionPath}`);

      return authState;
    } catch (error) {
      logger.error(`Error restoring session for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Set up event handlers for a socket
   */
  private setupEventHandlers(
    botId: string,
    socket: WASocket,
    saveCreds: () => Promise<void>
  ): void {
    logger.debug(`Setting up event handlers for bot ${botId}`);

    // Handle connection updates
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      logger.debug(`Connection update for bot ${botId}:`, {
        connection,
        hasQR: !!qr,
        hasError: !!lastDisconnect?.error,
      });

      // Handle QR code generation
      if (qr) {
        logger.info(`QR code generated for bot ${botId}`);
        try {
          // Store QR code in Redis with 60 second TTL
          await redisStorage.storeQRCode(botId, qr);
          
          // Update database status to qr_required
          await this.updateConnectionStatus(botId, 'qr_required');
          
          // Publish qr:generated event
          await redisPubSubService.publishQRGenerated(botId);
          
          logger.info(`QR code stored and event published for bot ${botId}`);
        } catch (error) {
          logger.error(`Error handling QR code for bot ${botId}:`, error);
        }
      }

      if (connection === 'open') {
        // Connection established successfully
        logger.info(`Bot ${botId} connected successfully in worker`);
        
        this.updateConnectionInfo(botId, {
          status: 'connected',
          reconnectAttempts: 0,
          lastHealthCheck: new Date(),
          lastValidated: new Date(),
          socketValid: true,
        });

        await this.updateConnectionStatus(botId, 'connected');

        // Update health metrics
        await this.updateConnectionHealth(botId, {
          status: 'healthy',
          reconnectAttempts: 0,
          connectedAt: new Date(),
        });

        // Log connection metric
        const health = this.connectionHealth.get(botId);
        metricsService.logConnectionEvent(botId, 'connect', {
          attempt: health?.reconnectAttempts || 0,
        });

        // Delete QR code from Redis (no longer needed)
        try {
          await redisStorage.deleteQRCode(botId);
        } catch (error) {
          logger.warn(`Error deleting QR code for bot ${botId}:`, error);
        }

        // Invalidate groups cache on reconnect
        try {
          const { botService } = await import('./bot.service');
          await botService.invalidateGroupsCache(botId);
          logger.debug(`Invalidated groups cache for bot ${botId} on reconnect`);
        } catch (error) {
          logger.warn(`Error invalidating groups cache for bot ${botId}:`, error);
          // Don't fail the connection if cache invalidation fails
        }

        // Get phone number and publish bot:connected event
        const phoneNumber = socket.user?.id?.split(':')[0];
        if (phoneNumber) {
          await this.updateBotPhoneNumber(botId, phoneNumber);
          logger.info(`Bot ${botId} phone number: ${phoneNumber}`);
          
          // Publish bot:connected event
          try {
            await redisPubSubService.publishBotConnected(botId, phoneNumber);
            logger.info(`Published bot:connected event for bot ${botId}`);
          } catch (error) {
            logger.error(`Error publishing bot:connected event for bot ${botId}:`, error);
          }
        }

        // Generate API key automatically on first connection
        try {
          await this.generateApiKeyOnConnection(botId);
        } catch (error) {
          logger.error(`Error generating API key for bot ${botId}:`, error);
          // Don't fail the connection if API key generation fails
        }
      } else if (connection === 'close') {
        // Connection closed
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        // Check if this is an authentication error (401)
        const isAuthError = statusCode === 401 || statusCode === DisconnectReason.loggedOut;

        logger.info(`Bot ${botId} connection closed`, {
          statusCode,
          shouldReconnect,
          isAuthError,
          isShuttingDown: this.isShuttingDown,
        });

        // If authentication error, delete the invalid session
        if (isAuthError) {
          logger.warn(`Bot ${botId} has invalid session (status ${statusCode}), deleting session`);
          try {
            await this.deleteSession(botId);
            logger.info(`Invalid session deleted for bot ${botId}, ready for fresh QR code generation`);
          } catch (error) {
            logger.error(`Error deleting invalid session for bot ${botId}:`, error);
          }
        }

        // Update status
        this.updateConnectionInfo(botId, {
          status: 'disconnected',
        });

        await this.updateConnectionStatus(botId, 'disconnected');

        // Delete QR code from Redis if it exists
        try {
          await redisStorage.deleteQRCode(botId);
        } catch (error) {
          logger.warn(`Error deleting QR code for bot ${botId}:`, error);
        }

        // Record error in health tracking
        const errorMessage = lastDisconnect?.error?.message || 'Connection closed';
        await this.recordConnectionError(botId, errorMessage);

        // Log disconnection metric
        metricsService.logConnectionEvent(botId, 'disconnect');

        // Remove from connections map
        this.connections.delete(botId);

        // Publish appropriate event based on disconnect reason
        if (shouldReconnect && !isAuthError) {
          // Unexpected disconnection (not auth error)
          const reason = lastDisconnect?.error?.message || 'Unknown reason';
          try {
            await redisPubSubService.publishConnectionLost(botId, reason);
            logger.info(`Published bot:connection_lost event for bot ${botId}`);
          } catch (error) {
            logger.error(`Error publishing bot:connection_lost event for bot ${botId}:`, error);
          }
        } else {
          // Normal disconnection (logged out or auth error)
          try {
            await redisPubSubService.publishBotDisconnected(botId);
            logger.info(`Published bot:disconnected event for bot ${botId}`);
          } catch (error) {
            logger.error(`Error publishing bot:disconnected event for bot ${botId}:`, error);
          }
        }

        // Attempt reconnection if appropriate (but not for auth errors)
        if (shouldReconnect && !isAuthError && !this.isShuttingDown) {
          const health = this.connectionHealth.get(botId);
          const attempts = health?.reconnectAttempts || 0;
          
          // Update health with reconnect attempt
          await this.updateConnectionHealth(botId, {
            reconnectAttempts: attempts + 1,
          });
          
          this.scheduleReconnection(botId, attempts);
        } else if (!shouldReconnect || isAuthError) {
          logger.info(`Bot ${botId} logged out or has auth error, not reconnecting`);
        }
      }
    });

    // Save credentials on update
    socket.ev.on('creds.update', async () => {
      try {
        await saveCreds();
        logger.debug(`Credentials updated for bot ${botId}`);
      } catch (error) {
        logger.error(`Error saving credentials for bot ${botId}:`, error);
      }
    });

    logger.debug(`Event handlers set up for bot ${botId}`);
  }

  /**
   * Update bot phone number in database
   */
  private async updateBotPhoneNumber(botId: string, phoneNumber: string): Promise<void> {
    try {
      await db.query(
        'UPDATE bots SET phone_number = $1 WHERE id = $2',
        [phoneNumber, botId]
      );
    } catch (error) {
      logger.error(`Error updating phone number for bot ${botId}:`, error);
    }
  }

  /**
   * Generate API key automatically on bot connection
   * Checks if API key already exists before generating
   */
  private async generateApiKeyOnConnection(botId: string): Promise<void> {
    try {
      logger.info(`Checking API key for bot ${botId}`);

      // Get bot's user ID
      const userId = await this.getBotUserId(botId);
      if (!userId) {
        logger.error(`Cannot generate API key: user ID not found for bot ${botId}`);
        return;
      }

      // Check if API key already exists
      const existingKeyResult = await db.query(
        'SELECT id FROM api_keys WHERE bot_id = $1 AND is_active = true LIMIT 1',
        [botId]
      );

      if (existingKeyResult.rows.length > 0) {
        logger.info(`API key already exists for bot ${botId}, skipping generation`);
        return;
      }

      // Generate new API key
      logger.info(`Generating new API key for bot ${botId}`);
      const { authService } = await import('./auth.service');
      const newApiKey = await authService.generateApiKey(userId, botId);

      // Keep a short-lived display cache for immediate UI updates; the key is also encrypted in the database.
      const { cacheService } = await import('./cache.service');
      const cacheKey = `api_key_display:${botId}`;
      await cacheService.set(cacheKey, newApiKey, 86400); // 24 hours TTL

      logger.info(`API key generated and cached for bot ${botId}`, {
        userId,
        botId,
        displayCacheExpiresIn: 86400,
      });

      // Emit WebSocket event for API key generation (will be implemented in sub-task 3.2)
      try {
        const { socketService } = await import('./socket.service');
        socketService.emitApiKeyGenerated(userId, botId, newApiKey);
        logger.info(`Emitted API key generated event for bot ${botId}`);
      } catch (error) {
        logger.debug('Socket service not available or error emitting event:', error);
        // Not critical - user can still retrieve key via API
      }

      // Audit log: API key generation
      logger.info(`API key auto-generated on connection for bot ${botId}`, {
        userId,
        botId,
        action: 'auto_generate_api_key',
        result: 'success',
      });
    } catch (error) {
      logger.error(`Error generating API key for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private async scheduleReconnection(botId: string, attempt: number = 0): Promise<void> {
    // Check if we should stop reconnecting
    if (this.isShuttingDown) {
      logger.info(`Not scheduling reconnection for bot ${botId} - shutting down`);
      return;
    }

    if (attempt >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error(`Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached for bot ${botId}`);
      
      // Record final error in health metrics
      this.recordConnectionError(
        botId,
        `Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached`
      );
      
      // Update health status to unhealthy
      this.updateConnectionHealth(botId, {
        status: 'unhealthy',
        reconnectAttempts: this.MAX_RECONNECT_ATTEMPTS,
      });

      // Send alert
      await alertService.alertMaxReconnectAttemptsReached(botId, this.MAX_RECONNECT_ATTEMPTS);
      
      return;
    }

    // Calculate delay with exponential backoff: 1s, 2s, 4s, 8s, 16s (max 30s)
    const delay = Math.min(
      1000 * Math.pow(2, attempt),
      this.MAX_BACKOFF_DELAY
    );

    logger.info(`Scheduling reconnection for bot ${botId}`, {
      attempt: attempt + 1,
      maxAttempts: this.MAX_RECONNECT_ATTEMPTS,
      delayMs: delay,
      nextAttemptAt: new Date(Date.now() + delay).toISOString(),
    });

    setTimeout(async () => {
      // Double-check shutdown flag before reconnecting
      if (this.isShuttingDown) {
        logger.info(`Skipping reconnection for bot ${botId} - shutting down`);
        return;
      }

      try {
        logger.info(`Attempting reconnection for bot ${botId} (attempt ${attempt + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
        
        // Update status to connecting
        await this.updateConnectionStatus(botId, 'connecting');
        
        // Attempt to create connection
        await this.createConnection(botId);
        
        logger.info(`Reconnection successful for bot ${botId} after ${attempt + 1} attempts`);
        
        // Reset reconnect attempts in health metrics
        await this.updateConnectionHealth(botId, {
          status: 'healthy',
          reconnectAttempts: 0,
        });

        // Log reconnection metric
        metricsService.logConnectionEvent(botId, 'reconnect', {
          attempt: attempt + 1,
        });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Reconnection failed for bot ${botId} (attempt ${attempt + 1}):`, errorMessage);
        
        // Record error in health metrics
        await this.recordConnectionError(botId, `Reconnection attempt ${attempt + 1} failed: ${errorMessage}`);

        // Log failed connection metric
        metricsService.logConnectionEvent(botId, 'failed', {
          attempt: attempt + 1,
          error: errorMessage,
        });
        
        // Schedule next attempt
        this.scheduleReconnection(botId, attempt + 1);
      }
    }, delay);
  }

  /**
   * Start worker heartbeat mechanism
   */
  startHeartbeat(): void {
    if (this.heartbeatInterval) {
      logger.debug('Heartbeat already running');
      return;
    }

    const interval = 10000; // 10 seconds
    logger.info(`Starting worker heartbeat with ${interval}ms interval`);

    // Send initial heartbeat
    this.sendHeartbeat();

    this.heartbeatInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      await this.sendHeartbeat();
    }, interval);

    logger.info('Worker heartbeat started');
  }

  /**
   * Send heartbeat to Redis
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const connectionCount = this.connections.size;
      const botIds = Array.from(this.connections.keys());

      // Store heartbeat data
      await redisStorage.storeWorkerHeartbeat(this.workerId, {
        timestamp: Date.now(),
        connectionCount,
        hostname: os.hostname(),
        pid: process.pid,
      });

      // Store connection list
      await redisStorage.storeWorkerConnections(this.workerId, botIds);

      logger.debug(`Heartbeat sent for worker ${this.workerId}`, {
        connectionCount,
        botCount: botIds.length,
      });
    } catch (error) {
      logger.error(`Error sending heartbeat for worker ${this.workerId}:`, error);
    }
  }

  /**
   * Stop worker heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('Worker heartbeat stopped');
    }
  }

  /**
   * Start periodic metrics logging
   */
  private metricsInterval: NodeJS.Timeout | null = null;

  startMetricsLogging(): void {
    if (this.metricsInterval) {
      logger.debug('Metrics logging already running');
      return;
    }

    const interval = 300000; // 5 minutes
    logger.info(`Starting metrics logging with ${interval}ms interval`);

    // Log initial metrics
    metricsService.logSummary();

    this.metricsInterval = setInterval(() => {
      if (this.isShuttingDown) {
        return;
      }

      // Log metrics summary for last 5 minutes
      metricsService.logSummary(interval);

      // Clear metrics older than 1 hour
      metricsService.clearOldMetrics(3600000);
    }, interval);

    logger.info('Metrics logging started');
  }

  /**
   * Stop metrics logging
   */
  stopMetricsLogging(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      logger.info('Metrics logging stopped');
    }
  }

  /**
   * Start health check monitoring
   */
  startHealthCheck(): void {
    if (this.healthCheckInterval) {
      logger.debug('Health check already running');
      return;
    }

    const interval = config.worker.healthCheckInterval;
    logger.info(`Starting health check with ${interval}ms interval`);

    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      const connections = Array.from(this.connections.keys());
      logger.debug(`Running health check for ${connections.length} connections`);

      for (const botId of connections) {
        try {
          await this.checkConnectionHealth(botId);
        } catch (error) {
          logger.error(`Health check failed for bot ${botId}:`, error);
        }
      }
    }, interval);

    logger.info('Health check started');
  }

  /**
   * Initialize connection health tracking
   */
  private initializeConnectionHealth(botId: string): void {
    const health: ConnectionHealth = {
      botId,
      status: 'healthy',
      reconnectAttempts: 0,
      errors: [],
      uptime: 0,
      connectedAt: new Date(),
    };
    
    this.connectionHealth.set(botId, health);
    logger.debug(`Initialized health tracking for bot ${botId}`);
  }

  /**
   * Update connection health metrics
   */
  private async updateConnectionHealth(
    botId: string,
    updates: Partial<ConnectionHealth>
  ): Promise<void> {
    const health = this.connectionHealth.get(botId);
    
    if (!health) {
      logger.warn(`No health tracking found for bot ${botId}, initializing`);
      this.initializeConnectionHealth(botId);
      return;
    }

    // Update health object
    const updatedHealth = { ...health, ...updates };
    
    // Calculate uptime if connected
    if (health.connectedAt) {
      updatedHealth.uptime = Date.now() - health.connectedAt.getTime();
    }

    // Determine health status based on metrics
    const previousStatus = health.status;
    
    if (updatedHealth.reconnectAttempts >= 3) {
      updatedHealth.status = 'unhealthy';
    } else if (updatedHealth.reconnectAttempts >= 1 || updatedHealth.errors.length > 5) {
      updatedHealth.status = 'degraded';
    } else {
      updatedHealth.status = 'healthy';
    }

    // Alert on status changes
    if (previousStatus !== updatedHealth.status) {
      if (updatedHealth.status === 'unhealthy') {
        const recentErrors = updatedHealth.errors.slice(-5).map(e => e.error);
        await alertService.alertConnectionUnhealthy(botId, recentErrors);
      } else if (updatedHealth.status === 'degraded') {
        const reason = updatedHealth.reconnectAttempts >= 1
          ? `${updatedHealth.reconnectAttempts} reconnection attempts`
          : `${updatedHealth.errors.length} recent errors`;
        await alertService.alertConnectionDegraded(botId, reason);
      }
    }

    this.connectionHealth.set(botId, updatedHealth);

    // Store health metrics in Redis with 5 minute TTL
    try {
      await redisStorage.storeConnectionHealth(botId, updatedHealth);
      logger.debug(`Stored health metrics in Redis for bot ${botId}`);
    } catch (error) {
      logger.error(`Error storing health metrics for bot ${botId}:`, error);
    }
  }

  /**
   * Record connection error
   */
  private async recordConnectionError(botId: string, error: string): Promise<void> {
    const health = this.connectionHealth.get(botId);
    
    if (!health) {
      return;
    }

    // Add error to history (keep last 10)
    const errors = [
      ...health.errors,
      { timestamp: new Date(), error }
    ].slice(-10);

    await this.updateConnectionHealth(botId, { errors });
    logger.debug(`Recorded error for bot ${botId}: ${error}`);
  }

  /**
   * Get connection health for a bot
   */
  async getConnectionHealth(botId: string): Promise<ConnectionHealth | undefined> {
    // Try to get from memory first
    let health = this.connectionHealth.get(botId);
    
    if (!health) {
      // Try to get from Redis
      try {
        const redisHealth = await redisStorage.getConnectionHealth(botId);
        if (redisHealth) {
          this.connectionHealth.set(botId, redisHealth);
          health = redisHealth;
        }
      } catch (error) {
        logger.error(`Error getting health from Redis for bot ${botId}:`, error);
      }
    }

    return health;
  }

  /**
   * Get all connection health metrics
   */
  getAllConnectionHealth(): ConnectionHealth[] {
    return Array.from(this.connectionHealth.values());
  }

  /**
   * Check health of a specific connection
   */
  async checkConnectionHealth(botId: string): Promise<boolean> {
    const connInfo = this.connections.get(botId);

    if (!connInfo) {
      logger.debug(`No connection to check for bot ${botId}`);
      return false;
    }

    try {
      // Check connection status
      if (connInfo.status !== 'connected') {
        logger.warn(`Connection for bot ${botId} is not in connected state: ${connInfo.status}`);
        await this.updateConnectionHealth(botId, { status: 'unhealthy' });
        return false;
      }

      // Update last health check timestamp
      this.updateConnectionInfo(botId, {
        lastHealthCheck: new Date(),
      });

      // Update health metrics
      await this.updateConnectionHealth(botId, {
        status: 'healthy',
      });

      logger.debug(`Health check passed for bot ${botId}`);
      return true;
    } catch (error) {
      logger.error(`Error checking health for bot ${botId}:`, error);
      await this.recordConnectionError(botId, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Stop health check monitoring
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Health check stopped');
    }
  }

  /**
   * Save session state
   * Note: Sessions are automatically saved to filesystem by useMultiFileAuthState
   * This method provides explicit save functionality if needed
   */
  private async saveSession(botId: string, _socket: WASocket): Promise<void> {
    try {
      logger.debug(`Saving session for bot ${botId}`);
      
      // Session is automatically saved to filesystem by Baileys
      // through the saveCreds callback in useMultiFileAuthState
      // This is just a placeholder for any additional save logic
      
      logger.debug(`Session saved for bot ${botId}`);
    } catch (error) {
      logger.error(`Error saving session for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Delete session from filesystem
   * This is useful when a session becomes invalid (e.g., 401 error)
   */
  private async deleteSession(botId: string): Promise<void> {
    try {
      const sessionPath = path.join(config.baileys.sessionPath, botId);
      
      logger.info(`Deleting invalid session for bot ${botId} at ${sessionPath}`);
      
      // Check if session directory exists
      try {
        await fs.access(sessionPath);
        // Directory exists, delete it
        await fs.rm(sessionPath, { recursive: true, force: true });
        logger.info(`Session deleted successfully for bot ${botId}`);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          logger.debug(`Session directory does not exist for bot ${botId}, nothing to delete`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.error(`Error deleting session for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Graceful shutdown of the manager
   */
  async shutdown(): Promise<void> {
    logger.info('Starting graceful shutdown of Worker Baileys Manager');
    
    // Set shutdown flag to prevent new connections
    this.isShuttingDown = true;

    // Stop heartbeat interval
    this.stopHeartbeat();

    // Stop health check interval
    this.stopHealthCheck();

    // Stop metrics logging
    this.stopMetricsLogging();

    // Log final metrics summary
    metricsService.logSummary();

    // Get all active connections
    const connections = Array.from(this.connections.entries());
    logger.info(`Shutting down ${connections.length} connections`);

    // Set timeout for shutdown
    const shutdownTimeout = 30000; // 30 seconds
    const shutdownStartTime = Date.now();

    // Save all sessions without logout — preserve WhatsApp auth state
    // so bots auto-reconnect after worker restart without QR scan.
    const shutdownPromises = connections.map(async ([botId, connInfo]) => {
      try {
        logger.info(`Preserving session for bot ${botId} during shutdown`);

        // Save session state to filesystem (Baileys auth state stays valid)
        await this.saveSession(botId, connInfo.socket);

        // NOTE: Do NOT call socket.logout() — that invalidates the session
        // on WhatsApp servers and forces QR rescan on restart.
        // The WebSocket will close automatically on process exit.

        // Save final health metrics
        const health = this.connectionHealth.get(botId);
        if (health) {
          await redisStorage.storeConnectionHealth(botId, health);
        }

        logger.info(`Session preserved for bot ${botId}`);
        return { botId, success: true };
      } catch (error) {
        logger.error(`Error preserving session for bot ${botId}:`, error);
        return { botId, success: false, error };
      }
    });

    // Wait for all shutdowns to complete or timeout
    try {
      const results = await Promise.race([
        Promise.all(shutdownPromises),
        new Promise<any[]>((resolve) => 
          setTimeout(() => {
            logger.warn(`Shutdown timeout reached after ${shutdownTimeout}ms`);
            resolve([]);
          }, shutdownTimeout)
        )
      ]);

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const elapsed = Date.now() - shutdownStartTime;

      logger.info(`Shutdown complete in ${elapsed}ms: ${successful} successful, ${failed} failed`);
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }

    // Clear connections map
    this.connections.clear();
    this.connectionHealth.clear();

    // Publish worker:stopped event
    try {
      await redisPubSubService.publishWorkerStopped(this.workerId);
      logger.info(`Published worker:stopped event for ${this.workerId}`);
    } catch (error) {
      logger.error('Error publishing worker:stopped event:', error);
    }

    // Clean up worker data from Redis
    try {
      await redisStorage.deleteWorkerData(this.workerId);
      logger.info(`Cleaned up worker data from Redis for ${this.workerId}`);
    } catch (error) {
      logger.error('Error cleaning up worker data:', error);
    }

    logger.info('Worker Baileys Manager shutdown complete');
  }
}

export const workerBaileysManager = new WorkerBaileysManager();
