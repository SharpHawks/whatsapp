import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { randomBytes } from 'crypto';

interface LockInfo {
  lockId: string;
  resource: string;
  acquiredAt: Date;
}

export class RedisLockService {
  private client: RedisClientType;
  private isConnected: boolean = false;
  private locks: Map<string, LockInfo> = new Map();

  // Lua script to release lock only if we own it
  private readonly releaseLockScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  // Lua script to extend lock only if we own it
  private readonly extendLockScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("pexpire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;

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
      logger.error('Redis Lock Service error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis Lock Service connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis Lock Service disconnected');
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

  /**
   * Acquire a distributed lock
   * @param resource - The resource to lock (e.g., 'bot:connection:bot-id')
   * @param ttl - Time to live in milliseconds (default: 30000ms = 30s)
   * @returns lockId if acquired, null if lock is already held
   */
  async acquireLock(resource: string, ttl: number = 30000): Promise<string | null> {
    try {
      const lockKey = `lock:${resource}`;
      const lockId = randomBytes(16).toString('hex');

      // Use SET with NX (only set if not exists) and PX (expiry in milliseconds)
      const result = await this.client.set(lockKey, lockId, {
        NX: true,
        PX: ttl,
      });

      if (result === 'OK') {
        this.locks.set(resource, {
          lockId,
          resource,
          acquiredAt: new Date(),
        });

        logger.info(`Lock acquired for resource: ${resource}`, {
          lockId,
          ttl,
        });

        return lockId;
      }

      logger.debug(`Failed to acquire lock for resource: ${resource} (already locked)`);
      return null;
    } catch (error) {
      logger.error(`Error acquiring lock for resource: ${resource}`, error);
      throw error;
    }
  }

  /**
   * Release a distributed lock
   * @param resource - The resource to unlock
   * @param lockId - The lock ID returned by acquireLock
   * @returns true if released, false if lock was not owned
   */
  async releaseLock(resource: string, lockId: string): Promise<boolean> {
    try {
      const lockKey = `lock:${resource}`;

      // Use Lua script to ensure we only delete the lock if we own it
      const result = await this.client.eval(this.releaseLockScript, {
        keys: [lockKey],
        arguments: [lockId],
      });

      const released = result === 1;

      if (released) {
        this.locks.delete(resource);
        logger.info(`Lock released for resource: ${resource}`, { lockId });
      } else {
        logger.warn(`Failed to release lock for resource: ${resource} (not owner or expired)`, {
          lockId,
        });
      }

      return released;
    } catch (error) {
      logger.error(`Error releasing lock for resource: ${resource}`, error);
      throw error;
    }
  }

  /**
   * Extend the TTL of an existing lock
   * @param resource - The resource to extend
   * @param lockId - The lock ID returned by acquireLock
   * @param ttl - New time to live in milliseconds
   * @returns true if extended, false if lock was not owned
   */
  async extendLock(resource: string, lockId: string, ttl: number): Promise<boolean> {
    try {
      const lockKey = `lock:${resource}`;

      // Use Lua script to ensure we only extend the lock if we own it
      const result = await this.client.eval(this.extendLockScript, {
        keys: [lockKey],
        arguments: [lockId, ttl.toString()],
      });

      const extended = result === 1;

      if (extended) {
        const lockInfo = this.locks.get(resource);
        if (lockInfo) {
          this.locks.set(resource, {
            ...lockInfo,
            acquiredAt: new Date(),
          });
        }

        logger.debug(`Lock extended for resource: ${resource}`, {
          lockId,
          ttl,
        });
      } else {
        logger.warn(`Failed to extend lock for resource: ${resource} (not owner or expired)`, {
          lockId,
        });
      }

      return extended;
    } catch (error) {
      logger.error(`Error extending lock for resource: ${resource}`, error);
      throw error;
    }
  }

  /**
   * Check if a lock is currently held
   * @param resource - The resource to check
   * @returns true if locked, false otherwise
   */
  async isLocked(resource: string): Promise<boolean> {
    try {
      const lockKey = `lock:${resource}`;
      const exists = await this.client.exists(lockKey);
      return exists === 1;
    } catch (error) {
      logger.error(`Error checking lock for resource: ${resource}`, error);
      throw error;
    }
  }

  /**
   * Get all locks held by this instance
   * @returns Array of lock information
   */
  getHeldLocks(): LockInfo[] {
    return Array.from(this.locks.values());
  }

  /**
   * Release all locks held by this instance
   */
  async releaseAllLocks(): Promise<void> {
    const locks = Array.from(this.locks.entries());

    for (const [resource, lockInfo] of locks) {
      try {
        await this.releaseLock(resource, lockInfo.lockId);
      } catch (error) {
        logger.error(`Error releasing lock during cleanup: ${resource}`, error);
      }
    }

    this.locks.clear();
    logger.info('All locks released');
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const lockService = new RedisLockService();
