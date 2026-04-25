import { redisStorage } from '../utils/redis-storage';
import { logger } from '../utils/logger';
import { db } from '../database';
import { ValidationError } from '../utils/errors';

export interface WorkerInfo {
  workerId: string;
  hostname: string;
  pid: number;
  connectionCount: number;
  lastHeartbeat: Date;
  status: 'active' | 'inactive';
  age: number; // milliseconds since last heartbeat
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'owner';
  emailVerified: boolean;
  balance: number;
  totalBots: number;
  activeBots: number;
  createdAt: Date;
}

export interface ListUsersOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'user' | 'admin' | 'owner';
}

export class AdminService {
  async listUsers(options: ListUsersOptions = {}): Promise<{
    users: AdminUser[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(options.page || 1, 1);
    const limit = Math.min(Math.max(options.limit || 20, 1), 100);
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (options.search) {
      conditions.push(`u.email ILIKE $${paramIndex++}`);
      values.push(`%${options.search}%`);
    }

    if (options.role) {
      conditions.push(`u.role = $${paramIndex++}`);
      values.push(options.role);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const usersResult = await db.query(
      `SELECT
         u.id,
         u.email,
         COALESCE(u.role, 'user') as role,
         u.email_verified as "emailVerified",
         COALESCE(bal.amount, 0) as balance,
         COUNT(b.id) as "totalBots",
         COUNT(b.id) FILTER (WHERE b.is_active = true) as "activeBots",
         u.created_at as "createdAt"
       FROM users u
       LEFT JOIN balances bal ON bal.user_id = u.id
       LEFT JOIN bots b ON b.user_id = u.id
       ${whereClause}
       GROUP BY u.id, u.email, u.role, u.email_verified, bal.amount, u.created_at
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM users u ${whereClause}`,
      values
    );

    return {
      users: usersResult.rows.map((row) => ({
        ...row,
        balance: parseFloat(row.balance),
        totalBots: parseInt(row.totalBots, 10),
        activeBots: parseInt(row.activeBots, 10),
      })),
      total: parseInt(countResult.rows[0]?.count || '0', 10),
      page,
      limit,
    };
  }

  async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<{
    id: string;
    email: string;
    role: 'user' | 'admin' | 'owner';
  }> {
    if (!['user', 'admin'].includes(role)) {
      throw new ValidationError('Role must be user or admin');
    }

    const result = await db.query(
      `UPDATE users
       SET role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND role != 'owner'
       RETURNING id, email, role`,
      [role, userId]
    );

    if (result.rows.length === 0) {
      throw new ValidationError('User not found or owner role cannot be changed');
    }

    logger.info('Admin updated user role', { userId, role });
    return result.rows[0];
  }

  /**
   * Get all active workers from Redis heartbeats
   * @returns Array of worker information with health status
   */
  async getActiveWorkers(): Promise<WorkerInfo[]> {
    try {
      const heartbeats = await redisStorage.getAllWorkerHeartbeats();
      const workers: WorkerInfo[] = [];
      const now = Date.now();

      for (const [workerId, heartbeat] of heartbeats.entries()) {
        const age = now - heartbeat.timestamp;
        const status = age < 30000 ? 'active' : 'inactive'; // 30 seconds threshold

        workers.push({
          workerId,
          hostname: heartbeat.hostname,
          pid: heartbeat.pid,
          connectionCount: heartbeat.connectionCount,
          lastHeartbeat: new Date(heartbeat.timestamp),
          status,
          age,
        });
      }

      // Sort by status (active first) then by workerId
      workers.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'active' ? -1 : 1;
        }
        return a.workerId.localeCompare(b.workerId);
      });

      logger.debug(`Retrieved ${workers.length} workers from Redis`);
      return workers;
    } catch (error) {
      logger.error('Error getting active workers:', error);
      throw error;
    }
  }

  /**
   * Get connections managed by a specific worker
   * @param workerId - Worker identifier
   * @returns Array of bot IDs managed by the worker
   */
  async getWorkerConnections(workerId: string): Promise<string[]> {
    try {
      const connections = await redisStorage.getWorkerConnections(workerId);
      logger.debug(`Retrieved ${connections.length} connections for worker ${workerId}`);
      return connections;
    } catch (error) {
      logger.error(`Error getting connections for worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific worker
   * @param workerId - Worker identifier
   * @returns Worker information or null if not found
   */
  async getWorkerInfo(workerId: string): Promise<WorkerInfo | null> {
    try {
      const heartbeat = await redisStorage.getWorkerHeartbeat(workerId);

      if (!heartbeat) {
        logger.debug(`Worker ${workerId} not found`);
        return null;
      }

      const now = Date.now();
      const age = now - heartbeat.timestamp;
      const status = age < 30000 ? 'active' : 'inactive';

      return {
        workerId,
        hostname: heartbeat.hostname,
        pid: heartbeat.pid,
        connectionCount: heartbeat.connectionCount,
        lastHeartbeat: new Date(heartbeat.timestamp),
        status,
        age,
      };
    } catch (error) {
      logger.error(`Error getting info for worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Get summary statistics for all workers
   * @returns Summary statistics
   */
  async getWorkerStats(): Promise<{
    totalWorkers: number;
    activeWorkers: number;
    inactiveWorkers: number;
    totalConnections: number;
  }> {
    try {
      const workers = await this.getActiveWorkers();

      const stats = {
        totalWorkers: workers.length,
        activeWorkers: workers.filter((w) => w.status === 'active').length,
        inactiveWorkers: workers.filter((w) => w.status === 'inactive').length,
        totalConnections: workers.reduce((sum, w) => sum + w.connectionCount, 0),
      };

      logger.debug('Worker stats:', stats);
      return stats;
    } catch (error) {
      logger.error('Error getting worker stats:', error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
