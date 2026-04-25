import { db } from '../database';
import { config } from '../config';
import { Balance, Transaction } from '../types';
import { PaymentError, NotFoundError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

export class BillingService {
  async getBalance(userId: string): Promise<Balance> {
    const result = await db.query<Balance>(
      `SELECT user_id as "userId", amount, currency, updated_at as "updatedAt"
       FROM balances
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND, 'Balance not found');
    }

    return result.rows[0];
  }

  async deductCost(userId: string, amount: number, reason: string): Promise<Transaction> {
    return await db.transaction(async (client) => {
      // Get current balance with row lock
      const balanceResult = await client.query<Balance>(
        'SELECT amount FROM balances WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (balanceResult.rows.length === 0) {
        throw new NotFoundError(ErrorCode.USER_NOT_FOUND, 'Balance not found');
      }

      const currentBalance = parseFloat(balanceResult.rows[0].amount.toString());

      // Check sufficient balance
      if (currentBalance < amount) {
        throw new PaymentError(
          ErrorCode.INSUFFICIENT_BALANCE,
          `Insufficient balance. Required: €${amount.toFixed(2)}, Available: €${currentBalance.toFixed(2)}`
        );
      }

      const newBalance = currentBalance - amount;

      // Update balance
      await client.query(
        'UPDATE balances SET amount = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [newBalance, userId]
      );

      // Create transaction record
      const transactionResult = await client.query<Transaction>(
        `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, status, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id as "userId", type, amount, balance_before as "balanceBefore",
                   balance_after as "balanceAfter", status, reason, timestamp`,
        [userId, 'deduction', amount, currentBalance, newBalance, 'completed', reason]
      );

      logger.info(`Balance deducted for user ${userId}: €${amount.toFixed(2)}`);
      return transactionResult.rows[0];
    });
  }

  calculateMessageCost(messageType: string): number {
    const pricing = config.pricing;
    
    switch (messageType) {
      case 'text':
        return pricing.text;
      case 'image':
        return pricing.image;
      case 'video':
        return pricing.video;
      case 'document':
        return pricing.document;
      case 'audio':
        return pricing.audio;
      case 'interactive':
        return pricing.interactive;
      default:
        return pricing.text;
    }
  }

  async hasBalance(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return parseFloat(balance.amount.toString()) >= amount;
  }

  async getTransactions(
    userId: string,
    filters?: {
      type?: 'topup' | 'deduction' | 'withdrawal';
      status?: 'pending' | 'completed' | 'failed';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const conditions: string[] = ['user_id = $1'];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (filters?.type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(filters.type);
    }

    if (filters?.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters?.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      values.push(filters.startDate);
    }

    if (filters?.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM transactions WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get transactions with pagination
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const result = await db.query<Transaction>(
      `SELECT id, user_id as "userId", type, amount, balance_before as "balanceBefore",
              balance_after as "balanceAfter", status, reason as description, 
              metadata, timestamp as "createdAt"
       FROM transactions
       WHERE ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    return {
      transactions: result.rows,
      total,
    };
  }
}

export const billingService = new BillingService();
