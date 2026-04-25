import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { subscriptionService } from '../services/subscription.service';
import { stripeService } from '../services/stripe.service';
import { getUserQuota, checkUnlimitedAccess } from '../middleware/quota.middleware';
import { db } from '../database';
import { ValidationError, NotFoundError, ErrorCode } from '../utils/errors';

const router = Router();

// All subscription routes require authentication
router.use(authenticateJWT);

// Get available subscription plans (public active plans)
router.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await subscriptionService.getActivePlans();
    res.json({ plans });
  } catch (error) {
    next(error);
  }
});

// Get current user's subscription info
router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    // Check unlimited access
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
          billingInterval: null,
          cancelAtPeriodEnd: false,
        },
      });
      return;
    }

    // Get subscription with plan details
    const subscription = await subscriptionService.getUserSubscription(userId);
    const quota = await getUserQuota(userId);

    if (!subscription) {
      res.json({
        role: quota.role,
        unlimited: false,
        plan: {
          name: 'No Plan',
          slug: 'none',
          messageQuota: 0,
          botLimit: 0,
        },
        usage: {
          messagesUsed: 0,
          messagesRemaining: 0,
          currentBots: quota.currentBots,
          botsRemaining: 0,
        },
        subscription: {
          status: 'none',
          currentPeriodEnd: null,
          billingInterval: null,
          cancelAtPeriodEnd: false,
        },
      });
      return;
    }

    // Get plan details
    const plan = await subscriptionService.getPlanById(subscription.planId);

    res.json({
      role: quota.role,
      unlimited: false,
      plan: {
        id: plan?.id,
        name: plan?.name || 'Unknown',
        slug: plan?.slug || 'unknown',
        messageQuota: quota.messageQuota,
        botLimit: quota.botLimit,
        priceMonthly: plan?.priceMonthly,
        priceYearly: plan?.priceYearly,
        features: plan?.features || [],
      },
      usage: {
        messagesUsed: quota.messagesUsed,
        messagesRemaining: Math.max(0, quota.messageQuota - quota.messagesUsed),
        usagePercentage: quota.messageQuota > 0 ? Math.round((quota.messagesUsed / quota.messageQuota) * 100) : 0,
        currentBots: quota.currentBots,
        botsRemaining: Math.max(0, quota.botLimit - quota.currentBots),
      },
      subscription: {
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        billingInterval: subscription.billingInterval,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        renewalCount: subscription.renewalCount,
        cancelledAt: subscription.cancelledAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create checkout session for subscription
router.post('/checkout', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { planSlug, billingInterval = 'monthly' } = req.body;

    if (!planSlug) {
      throw new ValidationError('Plan slug is required');
    }

    if (!['monthly', 'yearly'].includes(billingInterval)) {
      throw new ValidationError('Billing interval must be monthly or yearly');
    }

    // Get user email
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND, 'User not found');
    }

    const email = userResult.rows[0].email;

    // Create checkout session via Stripe
    const checkout = await stripeService.createSubscriptionCheckout(
      userId,
      email,
      planSlug,
      billingInterval as 'monthly' | 'yearly'
    );

    res.json({
      sessionId: checkout.sessionId,
      url: checkout.url,
    });
  } catch (error) {
    next(error);
  }
});

// Get billing portal session
router.post('/portal', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const userResult = await db.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    const stripeCustomerId = userResult.rows[0]?.stripe_customer_id;

    if (!stripeCustomerId) {
      throw new ValidationError('No billing information found. Please subscribe to a plan first.');
    }

    const portal = await stripeService.createPortalSession(userId, stripeCustomerId);

    res.json({ url: portal.url });
  } catch (error) {
    next(error);
  }
});

// Cancel subscription (at period end)
router.post('/cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    await subscriptionService.cancelSubscription(userId);
    res.json({ message: 'Subscription will be cancelled at the end of the current billing period' });
  } catch (error) {
    next(error);
  }
});

// Reactivate subscription
router.post('/reactivate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    await subscriptionService.reactivateSubscription(userId);
    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    next(error);
  }
});

// Get subscription event history
router.get('/events', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { limit = '20' } = req.query;

    const result = await db.query(
      `SELECT id, event_type as "eventType", plan_id as "planId", stripe_event_id as "stripeEventId",
              metadata, created_at as "createdAt"
       FROM subscription_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, parseInt(limit as string, 10)]
    );

    res.json({ events: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
