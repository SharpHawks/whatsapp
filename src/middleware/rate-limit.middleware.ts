import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { cacheService } from '../services/cache.service';
import { RateLimitError } from '../utils/errors';
import { config } from '../config';

export const rateLimitMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) {
      // Skip rate limiting if no user ID (shouldn't happen after auth)
      return next();
    }

    const endpoint = req.path;
    const count = await cacheService.incrementRateLimit(req.userId, endpoint);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.rateLimit.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.rateLimit.maxRequests - count));
    res.setHeader('X-RateLimit-Reset', Date.now() + config.rateLimit.windowMs);

    if (count > config.rateLimit.maxRequests) {
      throw new RateLimitError(
        `Rate limit exceeded. Maximum ${config.rateLimit.maxRequests} requests per minute.`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
