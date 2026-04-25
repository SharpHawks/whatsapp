import { Router, Response, NextFunction } from 'express';
import { botService } from '../services/bot.service';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { checkBotLimit } from '../middleware/quota.middleware';
import { ValidationError } from '../utils/errors';

const router = Router();

// All routes require JWT authentication
router.use(authenticateJWT);

// Create bot (with bot limit check)
router.post('/', checkBotLimit, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, webhookUrl } = req.body;

    if (!name) {
      throw new ValidationError('Bot name is required');
    }

    const bot = await botService.createBot(req.userId!, name, webhookUrl);

    res.status(201).json({
      message: 'Bot created successfully',
      bot,
    });
  } catch (error) {
    next(error);
  }
});

// List bots
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bots = await botService.listBots(req.userId!);

    res.json({
      bots,
      count: bots.length,
    });
  } catch (error) {
    next(error);
  }
});

// Get bot details
router.get('/:botId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;
    const bot = await botService.getBot(botId, req.userId!);

    res.json({ bot });
  } catch (error) {
    next(error);
  }
});

// Get bot status (connection status, health metrics, last activity)
router.get('/:botId/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;
    
    // Verify bot ownership
    await botService.getBot(botId, req.userId!);
    
    // Get detailed status
    const status = await botService.getBotStatus(botId, req.userId!);

    res.json(status);
  } catch (error) {
    next(error);
  }
});

// Get bot groups
router.get('/:botId/groups', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;
    
    // Verify bot ownership
    await botService.getBot(botId, req.userId!);
    
    // Get groups from bot service
    const groups = await botService.getBotGroups(botId, req.userId!);

    res.json({ groups });
  } catch (error) {
    next(error);
  }
});

// Update bot
router.put('/:botId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;
    const { name, webhookUrl, autoResponseEnabled } = req.body;

    const bot = await botService.updateBot(botId, req.userId!, {
      name,
      webhookUrl,
      autoResponseEnabled,
    });

    res.json({
      message: 'Bot updated successfully',
      bot,
    });
  } catch (error) {
    next(error);
  }
});

// Delete bot
router.delete('/:botId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;
    await botService.deleteBot(botId, req.userId!);

    res.json({
      message: 'Bot deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Connect bot
router.post('/:botId/connect', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;

    await botService.connectBot(botId, req.userId!);

    res.json({
      message: 'Bot connection initiated. Please wait for QR code.',
    });
  } catch (error) {
    next(error);
  }
});

// Disconnect bot
router.post('/:botId/disconnect', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;

    await botService.disconnectBot(botId, req.userId!);

    res.json({
      message: 'Bot disconnection initiated',
    });
  } catch (error) {
    next(error);
  }
});

// Get QR code
router.get('/:botId/qr', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;

    const qrCode = await botService.getQRCode(botId, req.userId!);

    if (!qrCode) {
      res.status(404).json({
        message: 'QR code not available. Bot may already be connected or QR code has expired.',
      });
      return;
    }

    res.json({
      qrCode,
      message: 'Scan this QR code with WhatsApp to connect the bot',
    });
  } catch (error) {
    next(error);
  }
});

// Send message (JWT authentication)
router.post('/:botId/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;
    const { to, type, content } = req.body;

    if (!to || !type || !content) {
      throw new ValidationError('Missing required fields: to, type, content');
    }

    // Verify bot ownership
    await botService.getBot(botId, req.userId!);

    // Import message service
    const { messageService } = await import('../services/message.service');

    const response = await messageService.sendMessage(req.userId!, botId, {
      botId,
      to,
      type,
      content,
    });

    res.json({
      message: 'Message queued successfully',
      ...response,
    });
  } catch (error) {
    next(error);
  }
});

// Get API key info (masked)
router.get('/:botId/api-key', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;

    // Verify bot ownership
    await botService.getBot(botId, req.userId!);

    // Import auth service
    const { authService } = await import('../services/auth.service');

    // Get API key info
    const apiKeyInfo = await authService.getApiKeyInfo(botId, req.userId!);

    res.json(apiKeyInfo);
  } catch (error) {
    next(error);
  }
});

// Reveal API key (requires password verification)
router.post('/:botId/api-key/reveal', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;
    const { password } = req.body;

    if (!password) {
      throw new ValidationError('Password is required');
    }

    // Verify bot ownership
    await botService.getBot(botId, req.userId!);

    // Import auth service
    const { authService } = await import('../services/auth.service');

    // Verify password
    await authService.verifyPassword(req.userId!, password);

    // Get API key from cache
    const apiKey = await authService.revealApiKey(botId, req.userId!);

    res.json({
      key: apiKey,
      expiresAt: new Date(Date.now() + 300000), // 5 minutes from now
    });
  } catch (error) {
    next(error);
  }
});

// Regenerate API key
router.post('/:botId/api-key/regenerate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;

    // Verify bot ownership
    await botService.getBot(botId, req.userId!);

    // Import auth service
    const { authService } = await import('../services/auth.service');

    // Regenerate API key
    const newApiKey = await authService.regenerateApiKeyForBot(botId, req.userId!);

    res.json({
      message: 'API key regenerated successfully',
      key: newApiKey,
      expiresAt: new Date(Date.now() + 300000), // 5 minutes from now
    });
  } catch (error) {
    next(error);
  }
});

export default router;
