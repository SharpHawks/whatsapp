import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { botService } from '../services/bot.service';
import { authenticateJWT, AuthRequest } from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';
import { loginRateLimitMiddleware } from '../middleware/login-rate-limit.middleware';

const router = Router();

// Register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const user = await authService.registerUser(email, password);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', loginRateLimitMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const tokens = await authService.loginUser(email, password);

    res.json({
      message: 'Login successful',
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    const tokens = await authService.refreshAccessToken(refreshToken);

    res.json({
      message: 'Token refreshed successfully',
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
});

// Get API keys (protected)
router.get('/api-keys', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const apiKeys = await authService.getApiKeys(req.userId!);

    res.json({
      apiKeys,
    });
  } catch (error) {
    next(error);
  }
});

// Regenerate API key (protected)
router.post('/api-keys/regenerate', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { botId } = req.body;

    if (botId) {
      await botService.getBot(botId, req.userId!);
    }

    const newApiKey = await authService.regenerateApiKey(req.userId!, botId);

    res.json({
      message: 'API key regenerated successfully',
      apiKey: newApiKey,
    });
  } catch (error) {
    next(error);
  }
});

// Verify password (protected)
router.post('/verify-password', authenticateJWT, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body;
    const userId = req.userId!;

    if (!password) {
      throw new ValidationError('Password is required');
    }

    const result = await authService.verifyPassword(userId, password);

    res.json({
      valid: result.valid,
      userId: result.userId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
