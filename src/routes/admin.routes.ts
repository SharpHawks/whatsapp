import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/require-admin.middleware';
import { connectionStatusService } from '../services/connection-status.service';
import { adminService } from '../services/admin.service';
import { logger } from '../utils/logger';

const router = Router();

// All admin routes require JWT auth + admin role
router.use(authenticateJWT, requireAdmin);

/**
 * GET /api/v1/admin/users
 * List platform users with balances and bot counts
 */
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const role = req.query.role ? String(req.query.role) : undefined;

    const result = await adminService.listUsers({
      page,
      limit,
      search: req.query.search ? String(req.query.search) : undefined,
      role: role === 'user' || role === 'admin' || role === 'owner' ? role : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/admin/users/:userId/role
 * Change a user role between customer and admin. Owner role is immutable.
 */
router.patch('/users/:userId/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const user = await adminService.updateUserRole(userId, role);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/connections
 * List all active bot connections with process information
 */
router.get('/connections', async (req: Request, res: Response) => {
  try {
    logger.info('Listing active connections', { userId: (req as any).userId });

    // Get all active connections
    const connections = await connectionStatusService.listActiveConnections();

    res.json({
      success: true,
      data: {
        connections,
        count: connections.length,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error listing active connections:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list active connections',
      },
    });
  }
});

/**
 * GET /api/v1/admin/connections/:botId
 * Get connection status for a specific bot
 */
router.get('/connections/:botId', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;

    logger.info(`Getting connection status for bot ${botId}`, {
      userId: (req as any).userId,
    });

    const status = await connectionStatusService.getConnectionStatus(botId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BOT_NOT_FOUND',
          message: 'Bot not found',
        },
      });
    }

    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Error getting connection status:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get connection status',
      },
    });
  }
});

/**
 * POST /api/v1/admin/connections/cleanup
 * Cleanup stale connections
 */
router.post('/connections/cleanup', async (req: Request, res: Response) => {
  try {
    logger.info('Cleaning up stale connections', { userId: (req as any).userId });

    const count = await connectionStatusService.cleanupStaleConnections();

    res.json({
      success: true,
      data: {
        cleanedUp: count,
        message: `Cleaned up ${count} stale connection(s)`,
      },
    });
  } catch (error) {
    logger.error('Error cleaning up stale connections:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to cleanup stale connections',
      },
    });
  }
});

/**
 * GET /api/v1/admin/workers
 * List all workers with their health status
 */
router.get('/workers', async (req: Request, res: Response) => {
  try {
    logger.info('Listing workers', { userId: (req as any).userId });

    const workers = await adminService.getActiveWorkers();
    const stats = await adminService.getWorkerStats();

    res.json({
      success: true,
      data: {
        workers,
        stats,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error listing workers:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list workers',
      },
    });
  }
});

/**
 * GET /api/v1/admin/workers/:workerId
 * Get detailed information about a specific worker
 */
router.get('/workers/:workerId', async (req: Request, res: Response) => {
  try {
    const { workerId } = req.params;

    logger.info(`Getting info for worker ${workerId}`, {
      userId: (req as any).userId,
    });

    const workerInfo = await adminService.getWorkerInfo(workerId);

    if (!workerInfo) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKER_NOT_FOUND',
          message: 'Worker not found',
        },
      });
    }

    return res.json({
      success: true,
      data: workerInfo,
    });
  } catch (error) {
    logger.error('Error getting worker info:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get worker info',
      },
    });
  }
});

/**
 * GET /api/v1/admin/workers/:workerId/connections
 * Get list of bot connections managed by a specific worker
 */
router.get('/workers/:workerId/connections', async (req: Request, res: Response) => {
  try {
    const { workerId } = req.params;

    logger.info(`Getting connections for worker ${workerId}`, {
      userId: (req as any).userId,
    });

    const connections = await adminService.getWorkerConnections(workerId);

    res.json({
      success: true,
      data: {
        workerId,
        connections,
        count: connections.length,
      },
    });
  } catch (error) {
    logger.error('Error getting worker connections:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get worker connections',
      },
    });
  }
});

export default router;
