import { Router, Response, NextFunction } from 'express';
import { autoResponseService } from '../services/auto-response.service';
import { botService } from '../services/bot.service';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';

const router = Router();

// All routes require JWT authentication
router.use(authenticateJWT);

// Create auto-response rule
router.post('/:botId/rules', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;
    const { keyword, response } = req.body;

    // Verify bot ownership
    await botService.getBot(botId, req.userId!);

    if (!keyword || !response) {
      throw new ValidationError('Keyword and response are required');
    }

    const rule = await autoResponseService.createRule(botId, keyword, response);

    res.status(201).json({
      message: 'Auto-response rule created successfully',
      rule,
    });
  } catch (error) {
    next(error);
  }
});

// Get all rules for bot
router.get('/:botId/rules', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.params;

    // Verify bot ownership
    await botService.getBot(botId, req.userId!);

    const rules = await autoResponseService.getRules(botId);

    res.json({
      rules,
      count: rules.length,
    });
  } catch (error) {
    next(error);
  }
});

// Get specific rule
router.get('/:botId/rules/:ruleId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId, ruleId } = req.params;

    // Verify bot ownership
    await botService.getBot(botId, req.userId!);

    const rule = await autoResponseService.getRule(ruleId, botId);

    res.json({ rule });
  } catch (error) {
    next(error);
  }
});

// Update rule
router.put('/:botId/rules/:ruleId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId, ruleId } = req.params;
    const { keyword, response, isActive } = req.body;

    // Verify bot ownership
    await botService.getBot(botId, req.userId!);

    const rule = await autoResponseService.updateRule(ruleId, botId, {
      keyword,
      response,
      isActive,
    });

    res.json({
      message: 'Auto-response rule updated successfully',
      rule,
    });
  } catch (error) {
    next(error);
  }
});

// Delete rule
router.delete('/:botId/rules/:ruleId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId, ruleId } = req.params;

    // Verify bot ownership
    await botService.getBot(botId, req.userId!);

    await autoResponseService.deleteRule(ruleId, botId);

    res.json({
      message: 'Auto-response rule deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
