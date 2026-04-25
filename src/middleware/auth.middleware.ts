import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthenticationError, ErrorCode } from '../utils/errors';

export interface AuthRequest extends Request {
  userId?: string;
  botId?: string;
}

export const authenticateJWT = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError(ErrorCode.INVALID_API_KEY, 'Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const { userId } = await authService.verifyToken(token);

    req.userId = userId;
    next();
  } catch (error) {
    next(error);
  }
};

export const authenticateApiKey = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new AuthenticationError(ErrorCode.INVALID_API_KEY, 'Missing API key');
    }

    const { userId, botId } = await authService.validateApiKey(apiKey);

    req.userId = userId;
    req.botId = botId;
    next();
  } catch (error) {
    next(error);
  }
};
