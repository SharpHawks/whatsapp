import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cache.service';
import { RateLimitError } from '../utils/errors';
import { logger } from '../utils/logger';

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * Rate limiting middleware specifically for login attempts
 * Blocks IP after 5 failed attempts for 15 minutes
 */
export const loginRateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const identifier = req.body.email || req.ip || 'unknown';
    const key = `login_attempts:${identifier}`;

    // Get current attempts
    const attemptsData = await cacheService.get<LoginAttempt>(key);
    const now = Date.now();

    if (attemptsData) {
      // Check if currently blocked
      if (attemptsData.blockedUntil && now < attemptsData.blockedUntil) {
        const remainingTime = Math.ceil((attemptsData.blockedUntil - now) / 1000 / 60);
        
        logger.warn(`Login attempt blocked for ${identifier}`, {
          identifier,
          remainingMinutes: remainingTime,
          attempts: attemptsData.count,
        });

        throw new RateLimitError(
          `Too many login attempts. Please try again in ${remainingTime} minutes.`
        );
      }

      // Check if attempt window has expired
      if (now - attemptsData.firstAttempt > ATTEMPT_WINDOW) {
        // Reset counter
        await cacheService.del(key);
      } else if (attemptsData.count >= MAX_LOGIN_ATTEMPTS) {
        // Block the user
        const blockedUntil = now + BLOCK_DURATION;
        await cacheService.set(
          key,
          { ...attemptsData, blockedUntil },
          Math.ceil(BLOCK_DURATION / 1000)
        );

        logger.warn(`Login attempts exceeded for ${identifier}, blocking for 15 minutes`, {
          identifier,
          attempts: attemptsData.count,
        });

        throw new RateLimitError(
          `Too many login attempts. Please try again in 15 minutes.`
        );
      }
    }

    // Store original end function to intercept response
    const originalEnd = res.end;
    let responseIntercepted = false;

    res.end = function (chunk?: any, encoding?: any, callback?: any): any {
      if (!responseIntercepted) {
        responseIntercepted = true;

        // Check if login failed (status 401 or error in response)
        const isLoginFailed = res.statusCode === 401 || res.statusCode === 400;

        if (isLoginFailed) {
          // Increment failed attempts
          const newAttempts: LoginAttempt = attemptsData
            ? { ...attemptsData, count: attemptsData.count + 1 }
            : { count: 1, firstAttempt: now };

          cacheService
            .set(key, newAttempts, Math.ceil(ATTEMPT_WINDOW / 1000))
            .catch((err) => logger.error('Failed to update login attempts:', err));

          logger.info(`Failed login attempt for ${identifier}`, {
            identifier,
            attempts: newAttempts.count,
            maxAttempts: MAX_LOGIN_ATTEMPTS,
          });
        } else if (res.statusCode === 200) {
          // Successful login - clear attempts
          cacheService.del(key).catch((err) => logger.error('Failed to clear login attempts:', err));
        }
      }

      // Call original end function
      return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
  } catch (error) {
    next(error);
  }
};
