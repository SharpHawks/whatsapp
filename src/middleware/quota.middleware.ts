import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { db } from '../database';
import { AuthorizationError } from '../utils/errors';
import { logger } from '../utils/logger';

interface UserQuota {
  role: string;
  unlimitedAccess: boolean;
  messageQuota: number;
  messagesUsed: number;
  botLimit: number;
  currentBots: number;
}

/**
 * Check if user has unlimited access (owner role)
 */
export async function checkUnlimitedAccess(userId: string): Promise<boolean> {
  const result = await db.query<{ role: string; unlimited_access: boolean }>(
    'SELECT role, unlimited_access FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const user = result.rows[0];
  return user.role === 'owner' || user.unlimited_access === true;
}

/**
 * Get user's current quota and usage
 */
export async function getUserQuota(userId: string): Promise<UserQuota> {
  const query = `
    SELECT 
      u.role,
      u.unlimited_access,
      COALESCE(sp.message_quota, 100) as message_quota,
      COALESCE(us.messages_used, 0) as messages_used,
      COALESCE(sp.bot_limit, 1) as bot_limit,
      (SELECT COUNT(*) FROM bots WHERE user_id = u.id) as current_bots
    FROM users u
    LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.status = 'active'
    LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE u.id = $1
  `;

  const result = await db.query(query, [userId]);

  if (result.rows.length === 0) {
    throw new AuthorizationError('User not found');
  }

  const row = result.rows[0];

  return {
    role: row.role,
    unlimitedAccess: row.unlimited_access || row.role === 'owner',
    messageQuota: row.message_quota,
    messagesUsed: row.messages_used,
    botLimit: row.bot_limit,
    currentBots: parseInt(row.current_bots, 10),
  };
}

/**
 * Middleware to check message quota before sending
 */
export async function checkMessageQuota(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId) {
      throw new AuthorizationError('User not authenticated');
    }

    // Check if user has unlimited access
    const hasUnlimitedAccess = await checkUnlimitedAccess(req.userId);

    if (hasUnlimitedAccess) {
      logger.info(`Quota check bypassed for owner user: ${req.userId}`);
      
      // Log the bypass for audit trail
      await db.query(
        `INSERT INTO usage_logs (user_id, bot_id, action_type, resource_count, bypassed)
         VALUES ($1, $2, 'message_send', 1, TRUE)`,
        [req.userId, req.botId || null]
      );

      return next();
    }

    // Get user's quota
    const quota = await getUserQuota(req.userId);

    // Check if quota exceeded
    if (quota.messagesUsed >= quota.messageQuota) {
      throw new AuthorizationError(
        `Message quota exceeded. You have used ${quota.messagesUsed} of ${quota.messageQuota} messages. Please upgrade your plan.`
      );
    }

    // Log usage
    await db.query(
      `INSERT INTO usage_logs (user_id, bot_id, action_type, resource_count, bypassed)
       VALUES ($1, $2, 'message_send', 1, FALSE)`,
      [req.userId, req.botId || null]
    );

    // Increment usage counter
    await db.query(
      `UPDATE user_subscriptions 
       SET messages_used = messages_used + 1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND status = 'active'`,
      [req.userId]
    );

    logger.info(
      `Message quota check passed for user ${req.userId}: ${quota.messagesUsed + 1}/${quota.messageQuota}`
    );

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to check bot limit before creating
 */
export async function checkBotLimit(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId) {
      throw new AuthorizationError('User not authenticated');
    }

    // Check if user has unlimited access
    const hasUnlimitedAccess = await checkUnlimitedAccess(req.userId);

    if (hasUnlimitedAccess) {
      logger.info(`Bot limit check bypassed for owner user: ${req.userId}`);
      return next();
    }

    // Get user's quota
    const quota = await getUserQuota(req.userId);

    // Check if bot limit exceeded
    if (quota.currentBots >= quota.botLimit) {
      throw new AuthorizationError(
        `Bot limit exceeded. You have ${quota.currentBots} of ${quota.botLimit} bots. Please upgrade your plan.`
      );
    }

    logger.info(
      `Bot limit check passed for user ${req.userId}: ${quota.currentBots + 1}/${quota.botLimit}`
    );

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Get user's quota information for display
 */
export async function getQuotaInfo(userId: string) {
  const hasUnlimitedAccess = await checkUnlimitedAccess(userId);

  if (hasUnlimitedAccess) {
    return {
      role: 'owner',
      unlimited: true,
      messageQuota: null,
      messagesUsed: null,
      messagesRemaining: null,
      botLimit: null,
      currentBots: null,
    };
  }

  const quota = await getUserQuota(userId);

  return {
    role: quota.role,
    unlimited: false,
    messageQuota: quota.messageQuota,
    messagesUsed: quota.messagesUsed,
    messagesRemaining: quota.messageQuota - quota.messagesUsed,
    botLimit: quota.botLimit,
    currentBots: quota.currentBots,
    botsRemaining: quota.botLimit - quota.currentBots,
  };
}
