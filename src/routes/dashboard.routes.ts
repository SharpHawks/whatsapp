import { Router, Response, NextFunction } from 'express';
import { db } from '../database';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Get dashboard statistics (JWT authentication)
router.get('/stats', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    // Get total messages
    const totalMessagesResult = await db.query(
      `SELECT COUNT(*) as count
       FROM messages m
       JOIN bots b ON m.bot_id = b.id
       WHERE b.user_id = $1`,
      [userId]
    );
    const totalMessages = parseInt(totalMessagesResult.rows[0]?.count || '0', 10);

    // Get messages this month
    const messagesThisMonthResult = await db.query(
      `SELECT COUNT(*) as count
       FROM messages m
       JOIN bots b ON m.bot_id = b.id
       WHERE b.user_id = $1
       AND m.timestamp >= date_trunc('month', CURRENT_DATE)`,
      [userId]
    );
    const messagesThisPeriod = parseInt(messagesThisMonthResult.rows[0]?.count || '0', 10);

    // Get messages today
    const messagesTodayResult = await db.query(
      `SELECT COUNT(*) as count
       FROM messages m
       JOIN bots b ON m.bot_id = b.id
       WHERE b.user_id = $1
       AND m.timestamp >= CURRENT_DATE`,
      [userId]
    );
    const messagesToday = parseInt(messagesTodayResult.rows[0]?.count || '0', 10);

    // Get current balance
    const balanceResult = await db.query(
      `SELECT amount FROM balances WHERE user_id = $1`,
      [userId]
    );
    const currentBalance = parseFloat(balanceResult.rows[0]?.amount || '0');

    // Get active bots count
    const activeBotsResult = await db.query(
      `SELECT COUNT(*) as count
       FROM bots
       WHERE user_id = $1
       AND connection_status = 'connected'
       AND is_active = true`,
      [userId]
    );
    const activeBots = parseInt(activeBotsResult.rows[0]?.count || '0', 10);

    // Get messages by day (last 30 days)
    const messagesByDayResult = await db.query(
      `SELECT DATE(m.timestamp) as date, COUNT(*) as count
       FROM messages m
       JOIN bots b ON m.bot_id = b.id
       WHERE b.user_id = $1
       AND m.timestamp >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE(m.timestamp)
       ORDER BY date DESC`,
      [userId]
    );
    const messagesByDay = messagesByDayResult.rows.map(row => ({
      date: row.date,
      count: parseInt(row.count, 10),
    }));

    res.json({
      totalMessages,
      messagesThisPeriod,
      currentBalance,
      activeBots,
      messagesToday,
      messagesByDay,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
