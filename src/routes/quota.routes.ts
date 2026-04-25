import { Router, Response, NextFunction } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { getUserQuota, checkUnlimitedAccess } from '../middleware/quota.middleware';
import { db } from '../database';

const router = Router();

// All routes require JWT authentication
router.use(authenticateJWT);

// Get current user's quota information
router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.userId!;

    // Check if user has unlimited access
    const hasUnlimitedAccess = await checkUnlimitedAccess(userId);

    if (hasUnlimitedAccess) {
      res.json({
        role: 'owner',
        unlimited: true,
        plan: {
          name: 'Owner Account',
          messageQuota: null,
          botLimit: null,
        },
        usage: {
          messagesUsed: null,
          messagesRemaining: null,
          currentBots: null,
          botsRemaining: null,
        },
        subscription: {
          status: 'unlimited',
          currentPeriodEnd: null,
        },
      });
      return;
    }

    // Get quota for regular users
    const quota = await getUserQuota(userId);

    // Get subscription details
    const subResult = await db.query(
      `SELECT 
        us.status,
        us.current_period_end,
        sp.name as plan_name,
        sp.slug as plan_slug,
        sp.price_monthly
      FROM user_subscriptions us
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE us.user_id = $1 AND us.status = 'active'`,
      [userId]
    );

    const subscription = subResult.rows[0] || {
      status: 'none',
      plan_name: 'No Plan',
      plan_slug: 'none',
    };

    res.json({
      role: quota.role,
      unlimited: false,
      plan: {
        name: subscription.plan_name,
        slug: subscription.plan_slug,
        price: subscription.price_monthly,
        messageQuota: quota.messageQuota,
        botLimit: quota.botLimit,
      },
      usage: {
        messagesUsed: quota.messagesUsed,
        messagesRemaining: Math.max(0, quota.messageQuota - quota.messagesUsed),
        usagePercentage: Math.round((quota.messagesUsed / quota.messageQuota) * 100),
        currentBots: quota.currentBots,
        botsRemaining: Math.max(0, quota.botLimit - quota.currentBots),
      },
      subscription: {
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get available subscription plans
router.get('/plans', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT id, name, slug, description, price_monthly, price_yearly, 
              message_quota, bot_limit, features
       FROM subscription_plans
       WHERE is_active = TRUE
       ORDER BY price_monthly ASC`
    );

    res.json({
      plans: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Get usage history
router.get('/usage', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = _req.userId!;
    const { days = '30' } = _req.query;

    const result = await db.query(
      `SELECT 
        DATE(created_at) as date,
        action_type,
        COUNT(*) as count,
        SUM(CASE WHEN bypassed THEN 1 ELSE 0 END) as bypassed_count
      FROM usage_logs
      WHERE user_id = $1 
        AND created_at >= CURRENT_DATE - INTERVAL '${parseInt(days as string, 10)} days'
      GROUP BY DATE(created_at), action_type
      ORDER BY date DESC, action_type`,
      [userId]
    );

    res.json({
      usage: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
