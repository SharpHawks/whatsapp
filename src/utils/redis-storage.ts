import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from './logger';

// Redis key patterns for consistency
export const REDIS_KEYS = {
  QR_CODE: (botId: string) => `qr:${botId}`,
  WORKER_HEARTBEAT: (workerId: string) => `worker:${workerId}:heartbeat`,
  WORKER_CONNECTIONS: (workerId: string) => `worker:${workerId}:connections`,
  CONNECTION_HEALTH: (botId: string) => `bot:connection:${botId}:health`,
  CONNECTION_STATE: (botId: string) => `bot:connection:${botId}:state`,
} as const;

// TTL constants (in seconds)
export const REDIS_TTL = {
  QR_CODE: 60,
  WORKER_HEARTBEAT: 30,
  WORKER_CONNECTIONS: 30,
  CONNECTION_HEALTH: 300, // 5 minutes
  CONNECTION_STATE: 300, // 5 minutes
} as const;

// Worker heartbeat data structure
export interface WorkerHeartbeat {
  timestamp: number;
  connectionCount: number;
  hostname: string;
  pid: number;
}

// Connection health data structure
export interface ConnectionHealth {
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
  uptime: number;
  connectedAt?: Date;
}

// Connection state data structure
export interface ConnectionState {
  botId: string;
  status: 'connected' | 'connecting' | 'disconnected';
  lastSeen: Date;
  phoneNumber?: string;
  reconnectAttempts: number;
}

/**
 * Redis storage utilities for worker connection management
 */
export class RedisStorage {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    this.client.on('error', (err) => {
      logger.error('Redis Storage error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis Storage connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis Storage disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected && !this.client.isOpen) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected && this.client.isOpen) {
      await this.client.disconnect();
    }
  }

  // QR Code storage methods
  
  /**
   * Store QR code in Redis with TTL
   * @param botId - Bot identifier
   * @param qrCode - QR code string (raw text for frontend to render)
   */
  async storeQRCode(botId: string, qrCode: string): Promise<void> {
    try {
      const key = REDIS_KEYS.QR_CODE(botId);
      await this.client.setEx(key, REDIS_TTL.QR_CODE, qrCode);
      logger.debug(`Stored QR code for bot ${botId} with ${REDIS_TTL.QR_CODE}s TTL`);
    } catch (error) {
      logger.error(`Failed to store QR code for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve QR code from Redis
   * @param botId - Bot identifier
   * @returns QR code string or null if not found/expired
   */
  async getQRCode(botId: string): Promise<string | null> {
    try {
      const key = REDIS_KEYS.QR_CODE(botId);
      const qrCode = await this.client.get(key);
      
      if (qrCode) {
        logger.debug(`Retrieved QR code for bot ${botId}`);
      } else {
        logger.debug(`QR code not found for bot ${botId} (may have expired)`);
      }
      
      return qrCode;
    } catch (error) {
      logger.error(`Failed to retrieve QR code for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Delete QR code from Redis
   * @param botId - Bot identifier
   */
  async deleteQRCode(botId: string): Promise<void> {
    try {
      const key = REDIS_KEYS.QR_CODE(botId);
      await this.client.del(key);
      logger.debug(`Deleted QR code for bot ${botId}`);
    } catch (error) {
      logger.error(`Failed to delete QR code for bot ${botId}:`, error);
      throw error;
    }
  }

  // Worker heartbeat methods
  
  /**
   * Store worker heartbeat in Redis with TTL
   * @param workerId - Worker identifier (e.g., hostname-pid)
   * @param heartbeat - Heartbeat data
   */
  async storeWorkerHeartbeat(workerId: string, heartbeat: WorkerHeartbeat): Promise<void> {
    try {
      const key = REDIS_KEYS.WORKER_HEARTBEAT(workerId);
      const value = JSON.stringify(heartbeat);
      await this.client.setEx(key, REDIS_TTL.WORKER_HEARTBEAT, value);
      logger.debug(`Stored heartbeat for worker ${workerId}`);
    } catch (error) {
      logger.error(`Failed to store heartbeat for worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve worker heartbeat from Redis
   * @param workerId - Worker identifier
   * @returns Heartbeat data or null if not found/expired
   */
  async getWorkerHeartbeat(workerId: string): Promise<WorkerHeartbeat | null> {
    try {
      const key = REDIS_KEYS.WORKER_HEARTBEAT(workerId);
      const data = await this.client.get(key);
      
      if (data) {
        return JSON.parse(data);
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to retrieve heartbeat for worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Get all worker heartbeats from Redis
   * @returns Map of workerId to heartbeat data
   */
  async getAllWorkerHeartbeats(): Promise<Map<string, WorkerHeartbeat>> {
    try {
      const pattern = 'worker:*:heartbeat';
      const keys = await this.client.keys(pattern);
      const heartbeats = new Map<string, WorkerHeartbeat>();
      
      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          // Extract workerId from key: worker:{workerId}:heartbeat
          const workerId = key.split(':')[1];
          heartbeats.set(workerId, JSON.parse(data));
        }
      }
      
      logger.debug(`Retrieved ${heartbeats.size} worker heartbeats`);
      return heartbeats;
    } catch (error) {
      logger.error('Failed to retrieve all worker heartbeats:', error);
      throw error;
    }
  }

  // Worker connection list methods
  
  /**
   * Store list of bot IDs managed by a worker
   * @param workerId - Worker identifier
   * @param botIds - Array of bot IDs
   */
  async storeWorkerConnections(workerId: string, botIds: string[]): Promise<void> {
    try {
      const key = REDIS_KEYS.WORKER_CONNECTIONS(workerId);
      const value = JSON.stringify(botIds);
      await this.client.setEx(key, REDIS_TTL.WORKER_CONNECTIONS, value);
      logger.debug(`Stored ${botIds.length} connections for worker ${workerId}`);
    } catch (error) {
      logger.error(`Failed to store connections for worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve list of bot IDs managed by a worker
   * @param workerId - Worker identifier
   * @returns Array of bot IDs or empty array if not found
   */
  async getWorkerConnections(workerId: string): Promise<string[]> {
    try {
      const key = REDIS_KEYS.WORKER_CONNECTIONS(workerId);
      const data = await this.client.get(key);
      
      if (data) {
        return JSON.parse(data);
      }
      
      return [];
    } catch (error) {
      logger.error(`Failed to retrieve connections for worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Delete worker connection list from Redis
   * @param workerId - Worker identifier
   */
  async deleteWorkerConnections(workerId: string): Promise<void> {
    try {
      const key = REDIS_KEYS.WORKER_CONNECTIONS(workerId);
      await this.client.del(key);
      logger.debug(`Deleted connections for worker ${workerId}`);
    } catch (error) {
      logger.error(`Failed to delete connections for worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all worker-related data from Redis
   * @param workerId - Worker identifier
   */
  async deleteWorkerData(workerId: string): Promise<void> {
    try {
      const heartbeatKey = REDIS_KEYS.WORKER_HEARTBEAT(workerId);
      const connectionsKey = REDIS_KEYS.WORKER_CONNECTIONS(workerId);
      
      await this.client.del([heartbeatKey, connectionsKey]);
      logger.info(`Deleted all data for worker ${workerId}`);
    } catch (error) {
      logger.error(`Failed to delete data for worker ${workerId}:`, error);
      throw error;
    }
  }

  // Connection health methods
  
  /**
   * Store connection health metrics in Redis
   * @param botId - Bot identifier
   * @param health - Health metrics
   */
  async storeConnectionHealth(botId: string, health: ConnectionHealth): Promise<void> {
    try {
      const key = REDIS_KEYS.CONNECTION_HEALTH(botId);
      const value = JSON.stringify(health);
      await this.client.setEx(key, REDIS_TTL.CONNECTION_HEALTH, value);
      logger.debug(`Stored health metrics for bot ${botId}`);
    } catch (error) {
      logger.error(`Failed to store health metrics for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve connection health metrics from Redis
   * @param botId - Bot identifier
   * @returns Health metrics or null if not found
   */
  async getConnectionHealth(botId: string): Promise<ConnectionHealth | null> {
    try {
      const key = REDIS_KEYS.CONNECTION_HEALTH(botId);
      const data = await this.client.get(key);
      
      if (data) {
        const health = JSON.parse(data);
        // Convert date strings back to Date objects
        if (health.lastMessageSent) health.lastMessageSent = new Date(health.lastMessageSent);
        if (health.lastMessageReceived) health.lastMessageReceived = new Date(health.lastMessageReceived);
        if (health.lastQRGenerated) health.lastQRGenerated = new Date(health.lastQRGenerated);
        if (health.connectedAt) health.connectedAt = new Date(health.connectedAt);
        health.errors = health.errors.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp)
        }));
        return health;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to retrieve health metrics for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Delete connection health metrics from Redis
   * @param botId - Bot identifier
   */
  async deleteConnectionHealth(botId: string): Promise<void> {
    try {
      const key = REDIS_KEYS.CONNECTION_HEALTH(botId);
      await this.client.del(key);
      logger.debug(`Deleted health metrics for bot ${botId}`);
    } catch (error) {
      logger.error(`Failed to delete health metrics for bot ${botId}:`, error);
      throw error;
    }
  }

  // Connection state methods
  
  /**
   * Store connection state in Redis
   * @param botId - Bot identifier
   * @param state - Connection state
   */
  async storeConnectionState(botId: string, state: ConnectionState): Promise<void> {
    try {
      const key = REDIS_KEYS.CONNECTION_STATE(botId);
      const value = JSON.stringify(state);
      await this.client.setEx(key, REDIS_TTL.CONNECTION_STATE, value);
      logger.debug(`Stored connection state for bot ${botId}`);
    } catch (error) {
      logger.error(`Failed to store connection state for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve connection state from Redis
   * @param botId - Bot identifier
   * @returns Connection state or null if not found
   */
  async getConnectionState(botId: string): Promise<ConnectionState | null> {
    try {
      const key = REDIS_KEYS.CONNECTION_STATE(botId);
      const data = await this.client.get(key);
      
      if (data) {
        const state = JSON.parse(data);
        // Convert date string back to Date object
        if (state.lastSeen) state.lastSeen = new Date(state.lastSeen);
        return state;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to retrieve connection state for bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Delete connection state from Redis
   * @param botId - Bot identifier
   */
  async deleteConnectionState(botId: string): Promise<void> {
    try {
      const key = REDIS_KEYS.CONNECTION_STATE(botId);
      await this.client.del(key);
      logger.debug(`Deleted connection state for bot ${botId}`);
    } catch (error) {
      logger.error(`Failed to delete connection state for bot ${botId}:`, error);
      throw error;
    }
  }

  // Health check
  
  /**
   * Check if Redis connection is healthy
   * @returns true if connected and responsive
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client.isOpen) {
        return false;
      }
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const redisStorage = new RedisStorage();
