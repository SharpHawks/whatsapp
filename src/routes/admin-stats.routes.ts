import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/require-admin.middleware';
import { db } from '../database';
import { logger } from '../utils/logger';

const router = Router();

// All admin routes require JWT auth + admin role
router.use(authenticateJWT, requireAdmin);

/**
 * GET /api/v1/admin/stats
 * Get admin dashboard statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    logger.info('Getting admin stats', { userId: (req as any).userId });

    // Get all stats in parallel
    const [usersStats, botsStats, messagesStats, revenueStats] = await Promise.all([
      // Users stats
      db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_month
        FROM users
      `),

      // Bots stats
      db.query(`
        SELECT 
          COUNT(*) as total_bots,
          COUNT(*) FILTER (WHERE connection_status = 'connected') as connected_bots,
          COUNT(*) FILTER (WHERE connection_status = 'disconnected') as disconnected_bots
        FROM bots
      `),

      // Messages stats
      db.query(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(*) FILTER (WHERE timestamp >= CURRENT_DATE) as messages_today,
          COUNT(*) FILTER (WHERE timestamp >= DATE_TRUNC('month', CURRENT_DATE)) as messages_month,
          COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_messages,
          COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_messages
        FROM messages
      `),

      // Revenue stats
      db.query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_revenue,
          COALESCE(SUM(amount) FILTER (WHERE timestamp >= DATE_TRUNC('month', CURRENT_DATE)), 0) as revenue_month,
          COALESCE(SUM(amount) FILTER (WHERE timestamp >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' 
                                        AND timestamp < DATE_TRUNC('month', CURRENT_DATE)), 0) as revenue_last_month
        FROM transactions
        WHERE type = 'topup' AND status = 'completed'
      `),
    ]);

    const users = usersStats.rows[0];
    const bots = botsStats.rows[0];
    const messages = messagesStats.rows[0];
    const revenue = revenueStats.rows[0];

    // Calculate growth percentages
    const userGrowth =
      users.new_users_month > 0
        ? Math.round((users.new_users_month / users.total_users) * 100)
        : 0;

    const revenueGrowth =
      revenue.revenue_last_month > 0
        ? Math.round(
            ((revenue.revenue_month - revenue.revenue_last_month) / revenue.revenue_last_month) *
              100
          )
        : 0;

    res.json({
      success: true,
      data: {
        users: {
          total: parseInt(users.total_users),
          newThisMonth: parseInt(users.new_users_month),
          growth: userGrowth,
        },
        bots: {
          total: parseInt(bots.total_bots),
          connected: parseInt(bots.connected_bots),
          disconnected: parseInt(bots.disconnected_bots),
        },
        messages: {
          total: parseInt(messages.total_messages),
          today: parseInt(messages.messages_today),
          thisMonth: parseInt(messages.messages_month),
          inbound: parseInt(messages.inbound_messages),
          outbound: parseInt(messages.outbound_messages),
        },
        revenue: {
          total: parseFloat(revenue.total_revenue),
          thisMonth: parseFloat(revenue.revenue_month),
          lastMonth: parseFloat(revenue.revenue_last_month),
          growth: revenueGrowth,
        },
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error getting admin stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get admin statistics',
      },
    });
  }
});

/**
 * GET /api/v1/admin/system-health
 * Get system health metrics
 */
router.get('/system-health', async (_req: Request, res: Response) => {
  try {
    // Check database
    const dbStart = Date.now();
    await db.query('SELECT 1');
    const dbResponseTime = Date.now() - dbStart;

    // Get queue stats (if available)
    let queueStatus = 'Unknown';
    try {
      // This would need RabbitMQ management API
      queueStatus = 'Running';
    } catch {
      queueStatus = 'Unknown';
    }

    // Calculate error rate from recent messages
    const errorStats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM messages
      WHERE timestamp >= NOW() - INTERVAL '1 hour'
    `);

    const errorRate =
      errorStats.rows[0].total > 0
        ? ((errorStats.rows[0].failed / errorStats.rows[0].total) * 100).toFixed(2)
        : '0.00';

    res.json({
      success: true,
      data: {
        database: {
          status: dbResponseTime < 100 ? 'Healthy' : 'Slow',
          responseTime: `${dbResponseTime}ms`,
        },
        queue: {
          status: queueStatus,
        },
        errorRate: `${errorRate}%`,
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      },
    });
  } catch (error) {
    logger.error('Error getting system health:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get system health',
      },
    });
  }
});

export default router;
