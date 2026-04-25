import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export class CacheService {
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
      logger.error('Redis error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  // API Key validation cache (1 hour TTL)
  async cacheApiKey(keyHash: string, data: { userId: string; botId?: string; isActive: boolean }): Promise<void> {
    const key = `apikey:${keyHash}`;
    await this.client.setEx(key, 3600, JSON.stringify(data));
  }

  async getApiKey(keyHash: string): Promise<{ userId: string; botId?: string; isActive: boolean } | null> {
    const key = `apikey:${keyHash}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateApiKey(keyHash: string): Promise<void> {
    const key = `apikey:${keyHash}`;
    await this.client.del(key);
  }

  // User balance cache (5 minutes TTL)
  async cacheBalance(userId: string, amount: number, currency: string): Promise<void> {
    const key = `balance:${userId}`;
    await this.client.setEx(key, 300, JSON.stringify({ amount, currency }));
  }

  async getBalance(userId: string): Promise<{ amount: number; currency: string } | null> {
    const key = `balance:${userId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async invalidateBalance(userId: string): Promise<void> {
    const key = `balance:${userId}`;
    await this.client.del(key);
  }

  // Rate limiting (1 minute TTL)
  async incrementRateLimit(userId: string, endpoint: string): Promise<number> {
    const key = `ratelimit:${userId}:${endpoint}`;
    const count = await this.client.incr(key);
    
    if (count === 1) {
      await this.client.expire(key, 60);
    }
    
    return count;
  }

  async getRateLimit(userId: string, endpoint: string): Promise<number> {
    const key = `ratelimit:${userId}:${endpoint}`;
    const count = await this.client.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  // Message status cache (24 hours TTL)
  async cacheMessageStatus(messageId: string, status: string): Promise<void> {
    const key = `message:${messageId}`;
    await this.client.setEx(key, 86400, JSON.stringify({ status, timestamp: new Date() }));
  }

  async getMessageStatus(messageId: string): Promise<{ status: string; timestamp: Date } | null> {
    const key = `message:${messageId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Generic cache methods
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setEx(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const cacheService = new CacheService();
