import Stripe from 'stripe';
import { config } from '../config';
import { db } from '../database';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2023-10-16',
    });
  }

  async createPaymentIntent(userId: string, amount: number): Promise<{ clientSecret: string; paymentIntentId: string }> {
    try {
      // Minimum top-up amount: 50 EUR
      if (amount < 50) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Minimum top-up amount is €50',
          400
        );
      }

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: config.stripe.currency.toLowerCase(),
        metadata: {
          userId,
          type: 'balance_topup',
        },
        automatic_payment_methods: {
          enabled: true,
        },
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

  async handleWebhook(payload: string | Buffer, signature: string): Promise<void> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );

      logger.info(`Stripe webhook received: ${event.type}`);

      switch (event.type) {
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

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata.userId;
    const amount = paymentIntent.amount / 100; // Convert from cents

    try {
      await db.transaction(async (client) => {
        // Get current balance
        const balanceResult = await client.query(
          'SELECT amount FROM balances WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        const currentBalance = parseFloat(balanceResult.rows[0].amount);
        const newBalance = currentBalance + amount;

        // Update balance
        await client.query(
          'UPDATE balances SET amount = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
          [newBalance, userId]
        );

        // Create transaction record
        await client.query(
          `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, reason, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            userId,
            'topup',
            amount,
            currentBalance,
            newBalance,
            'completed',
            'Stripe payment',
            JSON.stringify({ paymentIntentId: paymentIntent.id }),
          ]
        );
      });

      logger.info(`Balance topped up for user ${userId}: €${amount}`);
    } catch (error) {
      logger.error(`Failed to process payment success for user ${userId}:`, error);
      throw error;
    }
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata.userId;
    const amount = paymentIntent.amount / 100;

    logger.warn(`Payment failed for user ${userId}: ${paymentIntent.id}`);

    // Optionally create a failed transaction record
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
          userId,
          'topup',
          amount,
          currentBalance,
          currentBalance,
          'failed',
          'Stripe payment failed',
          JSON.stringify({ paymentIntentId: paymentIntent.id }),
        ]
      );
    }
  }

  async createPayout(userId: string, amount: number, _bankDetails: any): Promise<string> {
    try {
      // Create Stripe payout (requires Stripe Connect)
      // For now, this is a placeholder
      // In production, you would:
      // 1. Create a connected account for the user
      // 2. Create a payout to their bank account

      logger.info(`Payout requested for user ${userId}: €${amount}`);

      // Return payout ID
      return `payout_${Date.now()}`;
    } catch (error: any) {
      logger.error('Failed to create payout:', error);
      throw new AppError(
        ErrorCode.PAYMENT_FAILED,
        `Payout failed: ${error.message}`,
        500
      );
    }
  }
}

export const stripeService = new StripeService();
