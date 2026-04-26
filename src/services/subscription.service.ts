import { db } from '../database';
import { SubscriptionPlan, UserSubscription, SubscriptionEvent } from '../types';
import { NotFoundError, ErrorCode, AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export class SubscriptionService {
  /**
   * Get all active subscription plans
   */
  async getActivePlans(): Promise<SubscriptionPlan[]> {
    const result = await db.query<SubscriptionPlan>(
      `SELECT id, name, slug, description, price_monthly as "priceMonthly",
              price_yearly as "priceYearly", message_quota as "messageQuota",
              bot_limit as "botLimit", features, stripe_price_id as "stripePriceId",
              stripe_price_id_yearly as "stripePriceIdYearly", is_active as "isActive",
              sort_order as "sortOrder", created_at as "createdAt", updated_at as "updatedAt"
       FROM subscription_plans
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, price_monthly ASC`
    );

    return result.rows.map(row => ({
      ...row,
      features: Array.isArray(row.features) ? row.features : JSON.parse(row.features as any || '[]'),
    }));
  }

  /**
   * Get a plan by slug
   */
  async getPlanBySlug(slug: string): Promise<SubscriptionPlan | null> {
    const result = await db.query<SubscriptionPlan>(
      `SELECT id, name, slug, description, price_monthly as "priceMonthly",
              price_yearly as "priceYearly", message_quota as "messageQuota",
              bot_limit as "botLimit", features, stripe_price_id as "stripePriceId",
              stripe_price_id_yearly as "stripePriceIdYearly", is_active as "isActive",
              sort_order as "sortOrder", created_at as "createdAt", updated_at as "updatedAt"
       FROM subscription_plans
       WHERE slug = $1 AND is_active = TRUE`,
      [slug]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      features: Array.isArray(row.features) ? row.features : JSON.parse(row.features as any || '[]'),
    };
  }

  /**
   * Get a plan by ID
   */
  async getPlanById(planId: string): Promise<SubscriptionPlan | null> {
    const result = await db.query<SubscriptionPlan>(
      `SELECT id, name, slug, description, price_monthly as "priceMonthly",
              price_yearly as "priceYearly", message_quota as "messageQuota",
              bot_limit as "botLimit", features, stripe_price_id as "stripePriceId",
              stripe_price_id_yearly as "stripePriceIdYearly", is_active as "isActive",
              sort_order as "sortOrder", created_at as "createdAt", updated_at as "updatedAt"
       FROM subscription_plans
       WHERE id = $1 AND is_active = TRUE`,
      [planId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      features: Array.isArray(row.features) ? row.features : JSON.parse(row.features as any || '[]'),
    };
  }

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    const result = await db.query<UserSubscription>(
      `SELECT id, user_id as "userId", plan_id as "planId", status,
              current_period_start as "currentPeriodStart",
              current_period_end as "currentPeriodEnd", messages_used as "messagesUsed",
              stripe_subscription_id as "stripeSubscriptionId",
              stripe_payment_intent_id as "stripePaymentIntentId",
              billing_interval as "billingInterval", cancel_at_period_end as "cancelAtPeriodEnd",
              cancelled_at as "cancelledAt", renewal_count as "renewalCount",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM user_subscriptions
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  /**
   * Subscribe user to a plan
   */
  async subscribeUser(
    userId: string,
    planId: string,
    stripeSubscriptionId: string,
    billingInterval: 'monthly' | 'yearly' = 'monthly'
  ): Promise<UserSubscription> {
    return await db.transaction(async (client) => {
      // Get plan details
      const planResult = await client.query(
        `SELECT message_quota, bot_limit FROM subscription_plans WHERE id = $1`,
        [planId]
      );

      if (planResult.rows.length === 0) {
        throw new NotFoundError(ErrorCode.USER_NOT_FOUND, 'Subscription plan not found');
      }

      const periodDays = billingInterval === 'yearly' ? 365 : 30;

      // Delete any existing subscription
      await client.query(
        `DELETE FROM user_subscriptions WHERE user_id = $1`,
        [userId]
      );

      // Create new subscription
      const subResult = await client.query<UserSubscription>(
        `INSERT INTO user_subscriptions (
          user_id, plan_id, status, current_period_start, current_period_end,
          messages_used, stripe_subscription_id, billing_interval, cancel_at_period_end, renewal_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, user_id as "userId", plan_id as "planId", status,
                  current_period_start as "currentPeriodStart",
                  current_period_end as "currentPeriodEnd", messages_used as "messagesUsed",
                  stripe_subscription_id as "stripeSubscriptionId",
                  billing_interval as "billingInterval", cancel_at_period_end as "cancelAtPeriodEnd",
                  renewal_count as "renewalCount", created_at as "createdAt", updated_at as "updatedAt"`,
        [
          userId, planId, 'active', new Date(),
          new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
          0, stripeSubscriptionId, billingInterval, false, 1
        ]
      );

      // Log event
      await client.query(
        `INSERT INTO subscription_events (user_id, plan_id, event_type, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          userId, planId, 'subscription_created',
          JSON.stringify({ stripeSubscriptionId, billingInterval })
        ]
      );

      logger.info(`User ${userId} subscribed to plan ${planId} with interval ${billingInterval}`);
      return subResult.rows[0];
    });
  }

  /**
   * Cancel a subscription (at period end)
   */
  async cancelSubscription(userId: string): Promise<void> {
    await db.transaction(async (client) => {
      const subResult = await client.query(
        `SELECT id, plan_id, stripe_subscription_id, cancel_at_period_end
         FROM user_subscriptions WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      if (subResult.rows.length === 0) {
        throw new NotFoundError(ErrorCode.USER_NOT_FOUND, 'No active subscription found');
      }

      const sub = subResult.rows[0];

      if (sub.cancel_at_period_end) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Subscription is already cancelled',
          400
        );
      }

      // Cancel at period end - user keeps access until period ends
      await client.query(
        `UPDATE user_subscriptions
         SET cancel_at_period_end = TRUE, cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [sub.id]
      );

      // Log event
      await client.query(
        `INSERT INTO subscription_events (user_id, plan_id, event_type, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          userId, sub.plan_id, 'subscription_cancelled',
          JSON.stringify({ stripeSubscriptionId: sub.stripe_subscription_id, atPeriodEnd: true })
        ]
      );

      logger.info(`User ${userId} cancelled subscription. Access until period end.`);
    });
  }

  /**
   * Reactivate a subscription that was set to cancel at period end
   */
  async reactivateSubscription(userId: string): Promise<void> {
    await db.transaction(async (client) => {
      const subResult = await client.query(
        `SELECT id, plan_id, stripe_subscription_id, cancel_at_period_end
         FROM user_subscriptions WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      if (subResult.rows.length === 0) {
        throw new NotFoundError(ErrorCode.USER_NOT_FOUND, 'No active subscription found');
      }

      const sub = subResult.rows[0];

      if (!sub.cancel_at_period_end) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Subscription is not scheduled for cancellation',
          400
        );
      }

      await client.query(
        `UPDATE user_subscriptions
         SET cancel_at_period_end = FALSE, cancelled_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [sub.id]
      );

      // Log event
      await client.query(
        `INSERT INTO subscription_events (user_id, plan_id, event_type, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          userId, sub.plan_id, 'subscription_updated',
          JSON.stringify({ stripeSubscriptionId: sub.stripe_subscription_id, reactivated: true })
        ]
      );

      logger.info(`User ${userId} reactivated subscription`);
    });
  }

  /**
   * Renew subscription at period end
   */
  async renewSubscription(
    userId: string,
    newPeriodEnd: Date
  ): Promise<void> {
    await db.transaction(async (client) => {
      const subResult = await client.query(
        `SELECT id, plan_id, renewal_count, cancel_at_period_end
         FROM user_subscriptions WHERE user_id = $1`,
        [userId]
      );

      if (subResult.rows.length === 0) {
        throw new NotFoundError(ErrorCode.USER_NOT_FOUND, 'Subscription not found');
      }

      const sub = subResult.rows[0];

      // If cancelled at period end, expire it instead
      if (sub.cancel_at_period_end) {
        // Downgrade to free plan
        const freePlanResult = await client.query(
          `SELECT id FROM subscription_plans WHERE slug = 'free' LIMIT 1`
        );

        const freePlanId = freePlanResult.rows[0]?.id;

        if (freePlanId) {
          await client.query(
            `UPDATE user_subscriptions
             SET plan_id = $1, status = 'active', current_period_start = CURRENT_TIMESTAMP,
                 current_period_end = CURRENT_TIMESTAMP + INTERVAL '30 days',
                 messages_used = 0, stripe_subscription_id = NULL,
                 stripe_payment_intent_id = NULL, cancel_at_period_end = FALSE,
                 cancelled_at = NULL, renewal_count = 0, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [freePlanId, sub.id]
          );

          await client.query(
            `INSERT INTO subscription_events (user_id, plan_id, event_type, metadata)
             VALUES ($1, $2, $3, $4)`,
            [
              userId, freePlanId, 'subscription_expired',
              JSON.stringify({ previousPlanId: sub.plan_id })
            ]
          );

          logger.info(`User ${userId} subscription expired, downgraded to free`);
        }
        return;
      }

      // Actually renew
      await client.query(
        `UPDATE user_subscriptions
         SET current_period_start = CURRENT_TIMESTAMP,
             current_period_end = $1,
             messages_used = 0,
             renewal_count = renewal_count + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newPeriodEnd, sub.id]
      );

      await client.query(
        `INSERT INTO subscription_events (user_id, plan_id, event_type, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          userId, sub.plan_id, 'subscription_renewed',
          JSON.stringify({ renewalCount: sub.renewal_count + 1, newPeriodEnd })
        ]
      );

      logger.info(`User ${userId} subscription renewed until ${newPeriodEnd}`);
    });
  }

  /**
   * Record a subscription event from Stripe webhooks
   */
  async logEvent(
    userId: string,
    eventType: SubscriptionEvent['eventType'],
    planId?: string,
    stripeEventId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await db.query(
      `INSERT INTO subscription_events (user_id, plan_id, event_type, stripe_event_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, planId || null, eventType, stripeEventId || null, JSON.stringify(metadata || {})]
    );
  }

  /**
   * Reset message usage (called when a new billing period starts)
   */
  async resetMessageUsage(userId: string): Promise<void> {
    await db.query(
      `UPDATE user_subscriptions
       SET messages_used = 0, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    logger.info(`Reset message usage for user ${userId}`);
  }

  /**
   * Increment message usage
   */
  async incrementMessageUsage(userId: string): Promise<boolean> {
    const result = await db.query(
      `UPDATE user_subscriptions
       SET messages_used = messages_used + 1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if user is in trial period
   */
  async isInTrial(userId: string): Promise<boolean> {
    const result = await db.query(
      `SELECT trial_ends_at FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return false;
    return result.rows[0].trial_ends_at && new Date(result.rows[0].trial_ends_at) > new Date();
  }

  /**
   * Start a free trial for a user
   */
  async startTrial(userId: string, trialDays: number = 7): Promise<void> {
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    await db.query(
      `UPDATE users
       SET trial_ends_at = $1, trial_used = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [trialEndsAt, userId]
    );

    logger.info(`Started ${trialDays}-day trial for user ${userId}, ends at ${trialEndsAt}`);
  }
}

export const subscriptionService = new SubscriptionService();
