import { Router, Request, Response, NextFunction } from 'express';
import { billingService } from '../services/billing.service';
import { stripeService } from '../services/stripe.service';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';
import { config } from '../config';

const router = Router();

// Get balance (JWT authentication)
router.get('/balance', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const balance = await billingService.getBalance(req.userId!);

    res.json({ balance });
  } catch (error) {
    next(error);
  }
});

// Create top-up payment intent (JWT authentication)
router.post('/topup', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      throw new ValidationError('Invalid amount');
    }

    const paymentIntent = await stripeService.createPaymentIntent(req.userId!, amount);

    res.json({
      message: 'Payment intent created',
      ...paymentIntent,
    });
  } catch (error) {
    next(error);
  }
});

// Stripe webhook (no authentication - verified by signature)
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      throw new ValidationError('Missing Stripe signature');
    }

    await stripeService.handleWebhook(req.body, signature);

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

// Get transactions (JWT authentication)
router.get('/transactions', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, status, startDate, endDate, limit, offset } = req.query;

    const filters = {
      type: type as 'topup' | 'deduction' | 'withdrawal' | undefined,
      status: status as 'pending' | 'completed' | 'failed' | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    };

    const result = await billingService.getTransactions(req.userId!, filters);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Request withdrawal (JWT authentication)
router.post('/withdraw', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, bankDetails } = req.body;

    if (!amount || amount < config.withdrawal.minAmount) {
      throw new ValidationError(`Minimum withdrawal amount is €${config.withdrawal.minAmount}`);
    }

    if (!bankDetails || !bankDetails.accountNumber || !bankDetails.bankName || !bankDetails.accountHolder) {
      throw new ValidationError('Bank details are required (accountNumber, bankName, accountHolder)');
    }

    // Check balance
    const balance = await billingService.getBalance(req.userId!);
    const currentBalance = parseFloat(balance.amount.toString());

    if (currentBalance < amount) {
      throw new ValidationError('Insufficient balance');
    }

    // Calculate fee
    const fee = (amount * config.withdrawal.feePercent) / 100;
    const totalDeduction = amount + fee;

    if (currentBalance < totalDeduction) {
      throw new ValidationError(`Insufficient balance including ${config.withdrawal.feePercent}% withdrawal fee`);
    }

    // Deduct amount + fee
    await billingService.deductCost(
      req.userId!,
      totalDeduction,
      `Withdrawal: €${amount} + €${fee.toFixed(2)} fee`
    );

    // Create payout
    const payoutId = await stripeService.createPayout(req.userId!, amount, bankDetails);

    res.json({
      message: 'Withdrawal request submitted',
      amount,
      fee,
      payoutId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
