import { Response, NextFunction } from 'express';
import { db } from '../database';
import { AuthRequest } from './auth.middleware';
import { AuthorizationError } from '../utils/errors';

/**
 * Middleware that requires the authenticated user to have admin role.
 * Must be used after authenticateJWT.
 */
export const requireAdmin = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AuthorizationError('Authentication required');
    }

    const result = await db.query<{ role: string }>(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0 || !['admin', 'owner'].includes(result.rows[0].role)) {
      throw new AuthorizationError('Admin access required');
    }

    next();
  } catch (error) {
    next(error);
  }
};
