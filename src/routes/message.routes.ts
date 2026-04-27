import { Router, Response, NextFunction } from 'express';
import { messageService } from '../services/message.service';
import { authenticateApiKey, authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { checkMessageQuota } from '../middleware/quota.middleware';
import { ValidationError } from '../utils/errors';

const router = Router();

/**
 * POST /send
 * Send a message via WhatsApp.
 *
 * Body examples:
 *
 * Text:
 *   { "to": "+1234567890", "type": "text", "content": { "text": "Hello!" } }
 *
 * Image (by mediaId):
 *   { "to": "+1234567890", "type": "image", "content": { "mediaId": "uuid", "caption": "Optional" } }
 *
 * Image (by URL):
 *   { "to": "+1234567890", "type": "image", "content": { "mediaUrl": "https://example.com/img.jpg", "caption": "Optional" } }
 *
 * Image (by base64):
 *   { "to": "+1234567890", "type": "image", "content": { "base64": "iVBORw0KGgo...", "filename": "img.png" } }
 *
 * Document:
 *   { "to": "+1234567890", "type": "document", "content": { "mediaUrl": "https://example.com/file.pdf", "filename": "report.pdf" } }
 *
 * Video / Audio — same pattern as image.
 */
router.post('/send', authenticateApiKey, rateLimitMiddleware, checkMessageQuota, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { to, type, content } = req.body;

    if (!to || !type || !content) {
      throw new ValidationError('Missing required fields: to, type, content');
    }

    if (!req.botId) {
      throw new ValidationError('API key must be associated with a bot');
    }

    const response = await messageService.sendMessage(req.userId!, req.botId, {
      botId: req.botId,
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

// Get message history (API key authentication)
router.get('/history', authenticateApiKey, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.botId) {
      throw new ValidationError('API key must be associated with a bot');
    }

    const { direction, status, startDate, endDate, limit, offset } = req.query;

    const filters = {
      direction: direction as 'inbound' | 'outbound' | undefined,
      status: status as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    };

    const result = await messageService.getMessageHistory(req.botId, req.userId!, filters);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get message status (API key authentication)
router.get('/:messageId', authenticateApiKey, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { messageId } = req.params;

    const message = await messageService.getMessageStatus(messageId, req.userId!);

    res.json({ message });
  } catch (error) {
    next(error);
  }
});

// Get all messages for user (JWT authentication) - for frontend dashboard
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rawPage = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 && rawLimit <= 100 ? rawLimit : 20;

    const { botId, status, type, search } = req.query;

    const result = await messageService.getUserMessages(req.userId!, {
      botId: botId as string | undefined,
      status: status as string | undefined,
      type: type as string | undefined,
      search: search as string | undefined,
      page,
      limit,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
