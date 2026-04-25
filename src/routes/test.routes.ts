import { Router, Response, NextFunction } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { socketService } from '../services/socket.service';

const router = Router();

// Test Socket.IO events (development only)
router.post('/socket/bot-status', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId, status, phoneNumber } = req.body;
    
    socketService.emitBotStatus(req.userId!, botId, status, phoneNumber);
    
    res.json({ message: 'Bot status event emitted', botId, status });
  } catch (error) {
    next(error);
  }
});

router.post('/socket/new-message', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId, message } = req.body;
    
    socketService.emitNewMessage(req.userId!, botId, message);
    
    res.json({ message: 'New message event emitted', botId });
  } catch (error) {
    next(error);
  }
});

router.post('/socket/balance-update', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { balance, change } = req.body;
    
    socketService.emitBalanceUpdate(req.userId!, balance, change);
    
    res.json({ message: 'Balance update event emitted', balance, change });
  } catch (error) {
    next(error);
  }
});

router.post('/socket/low-balance', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { balance, threshold } = req.body;
    
    socketService.emitLowBalanceWarning(req.userId!, balance, threshold);
    
    res.json({ message: 'Low balance warning emitted', balance, threshold });
  } catch (error) {
    next(error);
  }
});

export default router;
