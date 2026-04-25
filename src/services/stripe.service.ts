import Stripe from 'stripe';
import { config } from '../config';
import { db } from '../database';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';
import { subscriptionService } from './subscription.service';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2023-10-16',
    });
  }

  // ==================== CUSTOMER MANAGEMENT ====================

  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    try {
      // Check if user already has a Stripe customer ID
      const userResult = await db.query(
        'SELECT stripe_customer_id FROM users WHERE id = $1',
        [userId]
      );

      const existingCustomerId = userResult.rows[0]?.stripe_customer_id;
      if (existingCustomerId) {
        return existingCustomerId;
      }

      // Create new customer in Stripe
      const customer = await this.stripe.customers.create({
        email,
        metadata: { userId },
      });

      // Save customer ID to database
      await db.query(
        'UPDATE users SET stripe_customer_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [customer.id, userId]
      );

      logger.info(`Created Stripe customer ${customer.id} for user ${userId}`);
      return customer.id;
    } catch (error: any) {
      logger.error('Failed to create Stripe customer:', error);
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        `Failed to create customer: ${error.message}`,
        500
      );
    }
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  async createSubscriptionCheckout(
    userId: string,
    email: string,
    planSlug: string,
    billingInterval: 'monthly' | 'yearly' = 'monthly'
  ): Promise<{ sessionId: string; url: string }> {
    try {
      // Get plan details
      const plan = await subscriptionService.getPlanBySlug(planSlug);
      if (!plan) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Plan not found', 400);
      }

      // Free plan does not require Stripe checkout
      if (plan.priceMonthly === 0) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Free plan does not require payment',
          400
        );
      }

      // Get or create Stripe customer
      const customerId = await this.getOrCreateCustomer(userId, email);

      // Get the correct Stripe price ID
      const priceId = billingInterval === 'yearly'
        ? plan.stripePriceIdYearly
        : plan.stripePriceId;

      if (!priceId) {
        throw new AppError(
          ErrorCode.PAYMENT_FAILED,
          'Stripe price not configured for this plan. Please contact support.',
          500
        );
      }

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        subscription_data: {
          metadata: { userId, planId: plan.id, planSlug, billingInterval },
        },
        success_url: `${config.security.corsOrigins[0] || 'http://localhost:5173'}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.security.corsOrigins[0] || 'http://localhost:5173'}/plans?cancelled=true`,
      });

      logger.info(`Created checkout session ${session.id} for user ${userId}, plan ${planSlug}`);

      return {
        sessionId: session.id,
        url: session.url!,
      };
    } catch (error: any) {
      logger.error('Failed to create checkout session:', error);
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        `Failed to create checkout: ${error.message}`,
        500
      );
    }
  }

  async createPortalSession(
    _userId: string,
    stripeCustomerId: string
  ): Promise<{ url: string }> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${config.security.corsOrigins[0] || 'http://localhost:5173'}/billing`,
      });

      return { url: session.url };
    } catch (error: any) {
      logger.error('Failed to create portal session:', error);
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        `Failed to create portal session: ${error.message}`,
        500
      );
    }
  }

  // ==================== LEGACY: TOP-UP (kept for reference, not used in subscription model) ====================

  async createPaymentIntent(userId: string, amount: number): Promise<{ clientSecret: string; paymentIntentId: string }> {
    try {
      if (amount < 50) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Minimum top-up amount is €50',
          400
        );
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: config.stripe.currency.toLowerCase(),
        metadata: { userId, type: 'balance_topup' },
        automatic_payment_methods: { enabled: true },
      });

      logger.info(`Payment intent created for user ${userId}: ${paymentIntent.id}`);

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error: any) {
      logger.error('Failed to create payment intent:', error);
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        `Payment failed: ${error.message}`,
        500
      );
    }
  }

  // ==================== WEBHOOK HANDLING ====================

  async handleWebhook(payload: string | Buffer, signature: string): Promise<void> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );

      logger.info(`Stripe webhook received: ${event.type}`);

      switch (event.type) {
        // CHECKOUT SESSIONS
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'checkout.session.async_payment_failed':
          await this.handleCheckoutSessionFailed(event.data.object as Stripe.Checkout.Session);
          break;

        // SUBSCRIPTION EVENTS
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        // INVOICE EVENTS (for renewals)
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        // LEGACY: PAYMENT INTENT (kept for backward compatibility)
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
          break;

        default:
          logger.debug(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error: any) {
      logger.error('Webhook handling failed:', error);
      throw error;
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;
    const planSlug = session.metadata?.planSlug;
    const billingInterval = session.metadata?.billingInterval as 'monthly' | 'yearly';

    if (!userId || !planId) {
      logger.warn('Checkout session completed without metadata', { sessionId: session.id });
      return;
    }

    try {
      await subscriptionService.subscribeUser(userId, planId, session.subscription as string, billingInterval);
      await subscriptionService.logEvent(userId, 'payment_succeeded', planId, undefined, {
        sessionId: session.id,
        planSlug,
        billingInterval,
      });

      logger.info(`Checkout completed for user ${userId}, plan ${planSlug}`);
    } catch (error) {
      logger.error(`Failed to process checkout completion for user ${userId}:`, error);
      throw error;
    }
  }

  private async handleCheckoutSessionFailed(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;

    if (userId && planId) {
      await subscriptionService.logEvent(userId, 'payment_failed', planId, undefined, {
        sessionId: session.id,
        reason: 'async_payment_failed',
      });
    }

    logger.warn(`Checkout session async payment failed: ${session.id}`);
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    logger.info(`Stripe subscription created: ${subscription.id}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    // Handle cancellation at period end set via Stripe dashboard
    if (subscription.cancel_at_period_end) {
      await db.query(
        `UPDATE user_subscriptions
         SET cancel_at_period_end = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId]
      );

      await subscriptionService.logEvent(userId, 'subscription_cancelled', undefined, undefined, {
        stripeSubscriptionId: subscription.id,
        atPeriodEnd: true,
        source: 'stripe_dashboard',
      });

      logger.info(`Subscription ${subscription.id} set to cancel at period end via Stripe`);
    } else {
      // Reactivation
      await db.query(
        `UPDATE user_subscriptions
         SET cancel_at_period_end = FALSE, cancelled_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId]
      );
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    // Downgrade to free plan when subscription is fully deleted
    await subscriptionService.renewSubscription(userId, new Date());

    logger.info(`Stripe subscription ${subscription.id} deleted, user ${userId} downgraded to free`);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string | undefined;
    if (!subscriptionId) return;

    try {
      const stripeSub = await this.stripe.subscriptions.retrieve(subscriptionId);
      const userId = stripeSub.metadata?.userId;
      const planId = stripeSub.metadata?.planId;

      if (!userId) return;

      const currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
      await subscriptionService.renewSubscription(userId, currentPeriodEnd);

      await subscriptionService.logEvent(userId, 'payment_succeeded', planId, invoice.id, {
        stripeSubscriptionId: subscriptionId,
        invoiceId: invoice.id,
        amount: invoice.amount_paid / 100,
      });

      logger.info(`Invoice paid for subscription ${subscriptionId}, renewed until ${currentPeriodEnd}`);
    } catch (error) {
      logger.error(`Failed to handle invoice.paid for subscription ${subscriptionId}:`, error);
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string | undefined;
    if (!subscriptionId) return;

    try {
      const stripeSub = await this.stripe.subscriptions.retrieve(subscriptionId);
      const userId = stripeSub.metadata?.userId;
      const planId = stripeSub.metadata?.planId;

      if (!userId) return;

      await subscriptionService.logEvent(userId, 'payment_failed', planId, invoice.id, {
        stripeSubscriptionId: subscriptionId,
        invoiceId: invoice.id,
        nextPaymentAttempt: invoice.next_payment_attempt,
      });

      // After multiple failures, Stripe will cancel the subscription automatically
      // We wait for customer.subscription.deleted event to handle downgrade

      logger.warn(`Invoice payment failed for subscription ${subscriptionId}, user ${userId}`);
    } catch (error) {
      logger.error(`Failed to handle invoice.payment_failed for subscription ${subscriptionId}:`, error);
    }
  }

  // ==================== LEGACY: PAYMENT INTENT HANDLERS ====================

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata?.userId;
    const type = paymentIntent.metadata?.type;
    const amount = paymentIntent.amount / 100;

    if (type !== 'balance_topup' || !userId) return;

    try {
      await db.transaction(async (client) => {
        const balanceResult = await client.query(
          'SELECT amount FROM balances WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        const currentBalance = parseFloat(balanceResult.rows[0]?.amount || '0');
        const newBalance = currentBalance + amount;

        await client.query(
          'UPDATE balances SET amount = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
          [newBalance, userId]
        );

        await client.query(
          `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, reason, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            userId, 'topup', amount, currentBalance, newBalance,
            'completed', 'Stripe payment',
            JSON.stringify({ paymentIntentId: paymentIntent.id }),
          ]
        );
      });

      logger.info(`Legacy balance topped up for user ${userId}: €${amount}`);
    } catch (error) {
      logger.error(`Failed to process legacy payment success for user ${userId}:`, error);
      throw error;
    }
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata?.userId;
    const amount = paymentIntent.amount / 100;

    if (!userId) return;

    const balanceResult = await db.query(
      'SELECT amount FROM balances WHERE user_id = $1',
      [userId]
    );

    if (balanceResult.rows.length > 0) {
      const currentBalance = parseFloat(balanceResult.rows[0].amount);
      await db.query(
        `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, reason, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId, 'topup', amount, currentBalance, currentBalance,
          'failed', 'Stripe payment failed',
          JSON.stringify({ paymentIntentId: paymentIntent.id }),
        ]
      );
    }
  }

  async createPayout(_userId: string, amount: number, _bankDetails: any): Promise<string> {
    logger.info(`Payout requested for user ${_userId}: €${amount}`);
    return `payout_${Date.now()}`;
  }
}

export const stripeService = new StripeService();
