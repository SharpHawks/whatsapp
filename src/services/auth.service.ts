import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../database';
import { config } from '../config';
import { User, AuthToken } from '../types';
import { AuthenticationError, ValidationError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 10;
const API_KEY_ENCRYPTION_ALGORITHM = 'aes-256-gcm';

export class AuthService {
  async registerUser(email: string, password: string): Promise<User> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }

    // Validate password strength
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Additional password strength checks
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      throw new ValidationError(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      );
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new ValidationError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user and balance in a transaction
    const result = await db.transaction(async (client) => {
      // Insert user
      const userResult = await client.query<User>(
        `INSERT INTO users (email, password_hash, email_verified)
         VALUES ($1, $2, $3)
         RETURNING id, email, password_hash as "passwordHash", email_verified as "emailVerified", 
                   role, created_at as "createdAt", updated_at as "updatedAt"`,
        [email, passwordHash, false]
      );

      const user = userResult.rows[0];

      // Create initial balance
      await client.query(
        'INSERT INTO balances (user_id, amount, currency) VALUES ($1, $2, $3)',
        [user.id, 0, 'EUR']
      );

      // Assign free plan subscription
      await client.query(
        `INSERT INTO user_subscriptions (user_id, plan_id, status, billing_interval, current_period_start, current_period_end)
         SELECT $1, id, 'active', 'monthly', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 month'
         FROM subscription_plans WHERE slug = 'free'`,
        [user.id]
      );

      return user;
    });

    logger.info(`User registered: ${email}`);
    return result;
  }

  async loginUser(email: string, password: string): Promise<AuthToken> {
    // Find user
    const result = await db.query<User>(
      `SELECT id, email, password_hash as "passwordHash", email_verified as "emailVerified", role
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = this.generateRefreshToken(user.id);

    logger.info(`User logged in: ${email}`);

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400, // 24 hours in seconds
    };
  }

  async validateApiKey(apiKey: string): Promise<{ userId: string; botId?: string }> {
    const keyHash = this.hashApiKey(apiKey);

    // Try cache first
    const { cacheService } = await import('./cache.service');
    const cached = await cacheService.getApiKey(keyHash);
    
    if (cached) {
      if (!cached.isActive) {
        throw new AuthenticationError(ErrorCode.INVALID_API_KEY, 'Invalid or inactive API key');
      }
      return { userId: cached.userId, botId: cached.botId };
    }

    // Cache miss - query database
    const result = await db.query(
      `SELECT user_id as "userId", bot_id as "botId", is_active as "isActive"
       FROM api_keys
       WHERE key_hash = $1`,
      [keyHash]
    );

    if (result.rows.length === 0 || !result.rows[0].isActive) {
      throw new AuthenticationError(ErrorCode.INVALID_API_KEY, 'Invalid or inactive API key');
    }

    // Cache the result
    await cacheService.cacheApiKey(keyHash, {
      userId: result.rows[0].userId,
      botId: result.rows[0].botId,
      isActive: result.rows[0].isActive,
    });

    // Update last used timestamp (async, don't wait)
    db.query(
      'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key_hash = $1',
      [keyHash]
    ).catch((err) => logger.error('Failed to update API key last used:', err));

    return {
      userId: result.rows[0].userId,
      botId: result.rows[0].botId,
    };
  }

  async generateApiKey(userId: string, botId?: string): Promise<string> {
    // Generate random API key
    const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = this.hashApiKey(apiKey);
    const encryptedKey = this.encryptApiKey(apiKey);

    // Store hash for authentication and encrypted key for owner reveal.
    await db.query(
      `INSERT INTO api_keys (key_hash, encrypted_key, user_id, bot_id, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [keyHash, encryptedKey, userId, botId || null, true]
    );

    logger.info(`API key generated for user: ${userId}`);
    return apiKey;
  }

  async regenerateApiKey(userId: string, botId?: string): Promise<string> {
    // Deactivate old keys
    await db.query(
      'UPDATE api_keys SET is_active = false WHERE user_id = $1 AND ($2::uuid IS NULL OR bot_id = $2)',
      [userId, botId || null]
    );

    // Generate new key
    return await this.generateApiKey(userId, botId);
  }

  async getApiKeys(userId: string) {
    const result = await db.query(
      `SELECT id, bot_id as "botId", is_active as "isActive", 
              last_used_at as "lastUsedAt", created_at as "createdAt"
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async verifyToken(token: string): Promise<{ userId: string }> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
      return decoded;
    } catch (error) {
      throw new AuthenticationError(ErrorCode.EXPIRED_TOKEN, 'Invalid or expired token');
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthToken> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string };
      
      // Get user info for new token
      const result = await db.query('SELECT email, role FROM users WHERE id = $1', [
        decoded.userId,
      ]);

      const user = result.rows[0];
      const accessToken = this.generateAccessToken(decoded.userId, user?.email, user?.role);
      const newRefreshToken = this.generateRefreshToken(decoded.userId);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 86400,
      };
    } catch (error) {
      throw new AuthenticationError(ErrorCode.EXPIRED_TOKEN, 'Invalid or expired refresh token');
    }
  }

  private generateAccessToken(userId: string, email?: string, role?: string): string {
    return jwt.sign({ userId, email, role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);
  }

  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  private getApiKeyEncryptionKey(): Buffer {
    return crypto.createHash('sha256').update(config.apiKeys.encryptionSecret).digest();
  }

  private encryptApiKey(apiKey: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      API_KEY_ENCRYPTION_ALGORITHM,
      this.getApiKeyEncryptionKey(),
      iv
    );
    const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  private decryptApiKey(encryptedApiKey: string): string {
    const [ivBase64, authTagBase64, encryptedBase64] = encryptedApiKey.split(':');

    if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
      throw new ValidationError('Stored API key is invalid. Please regenerate the key.');
    }

    const decipher = crypto.createDecipheriv(
      API_KEY_ENCRYPTION_ALGORITHM,
      this.getApiKeyEncryptionKey(),
      Buffer.from(ivBase64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  async verifyPassword(userId: string, password: string): Promise<{ valid: boolean; userId?: string }> {
    const { cacheService } = await import('./cache.service');
    
    // Rate limiting check: 3 attempts per 5 minutes
    const rateLimitKey = `password_attempts:${userId}`;
    const attempts = await cacheService.get<number>(rateLimitKey);
    
    if (attempts && attempts >= 3) {
      logger.warn(`Password verification rate limit exceeded for user: ${userId}`, {
        userId,
        attempts,
        action: 'verify_password',
        result: 'rate_limited',
      });
      throw new AuthenticationError(
        ErrorCode.INVALID_CREDENTIALS,
        'Too many attempts. Please try again in 5 minutes.'
      );
    }

    // Get user password hash
    const result = await db.query<User>(
      'SELECT password_hash as "passwordHash" FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      logger.warn(`Password verification failed: user not found`, {
        userId,
        action: 'verify_password',
        result: 'user_not_found',
      });
      throw new AuthenticationError(ErrorCode.INVALID_CREDENTIALS, 'Invalid password');
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      // Increment attempts counter
      const newAttempts = (attempts || 0) + 1;
      await cacheService.set(rateLimitKey, newAttempts, 300); // 5 minutes TTL

      // Audit log: failed attempt
      logger.warn(`Password verification failed for user: ${userId}`, {
        userId,
        attempts: newAttempts,
        action: 'verify_password',
        result: 'invalid_password',
      });

      throw new AuthenticationError(ErrorCode.INVALID_CREDENTIALS, 'Invalid password');
    }

    // Clear attempts on success
    await cacheService.del(rateLimitKey);

    // Audit log: successful verification
    logger.info(`Password verification successful for user: ${userId}`, {
      userId,
      action: 'verify_password',
      result: 'success',
    });

    return {
      valid: true,
      userId,
    };
  }

  async getApiKeyInfo(botId: string, userId: string): Promise<{
    id: string;
    maskedKey: string;
    botId: string;
    isActive: boolean;
    lastUsedAt: Date | null;
    createdAt: Date;
  } | null> {
    // Get API key for bot
    const result = await db.query(
      `SELECT id, key_hash as "keyHash", bot_id as "botId", is_active as "isActive",
              last_used_at as "lastUsedAt", created_at as "createdAt"
       FROM api_keys
       WHERE bot_id = $1 AND user_id = $2 AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [botId, userId]
    );

    if (result.rows.length === 0) {
      // Audit log: API key info not found
      logger.info(`API key info not found for bot: ${botId}`, {
        userId,
        botId,
        action: 'get_api_key_info',
        result: 'not_found',
      });
      return null;
    }

    const apiKey = result.rows[0];

    // Create masked key (show first 8 chars, rest as asterisks)
    const maskedKey = `sk_${'*'.repeat(56)}`;

    // Audit log: API key info retrieved
    logger.info(`API key info retrieved for bot: ${botId}`, {
      userId,
      botId,
      action: 'get_api_key_info',
      result: 'success',
    });

    return {
      id: apiKey.id,
      maskedKey,
      botId: apiKey.botId,
      isActive: apiKey.isActive,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
    };
  }

  async revealApiKey(botId: string, userId: string): Promise<string> {
    const { cacheService } = await import('./cache.service');

    // Check Redis cache first for recently generated keys
    const cacheKey = `api_key_display:${botId}`;
    const cachedKey = await cacheService.get<string>(cacheKey);

    if (cachedKey) {
      // Audit log: API key revealed from cache
      logger.info(`API key revealed from cache for bot: ${botId}`, {
        userId,
        botId,
        action: 'reveal_api_key',
        source: 'cache',
      });

      return cachedKey;
    }

    const result = await db.query(
      `SELECT encrypted_key as "encryptedKey"
       FROM api_keys
       WHERE bot_id = $1 AND user_id = $2 AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [botId, userId]
    );

    if (result.rows.length === 0) {
      throw new ValidationError('Active API key not found for this bot. Please generate a new key.');
    }

    const encryptedKey = result.rows[0].encryptedKey;
    if (!encryptedKey) {
      throw new ValidationError('This API key cannot be revealed. Please regenerate it once.');
    }

    const apiKey = this.decryptApiKey(encryptedKey);

    logger.info(`API key revealed from encrypted storage for bot: ${botId}`, {
      userId,
      botId,
      action: 'reveal_api_key',
      source: 'database',
    });

    return apiKey;
  }

  async regenerateApiKeyForBot(botId: string, userId: string): Promise<string> {
    const { cacheService } = await import('./cache.service');

    // Get old key hashes before deactivating (to clear from cache)
    const oldKeysResult = await db.query(
      'SELECT key_hash FROM api_keys WHERE bot_id = $1 AND user_id = $2 AND is_active = true',
      [botId, userId]
    );

    // Deactivate old keys for this bot
    await db.query(
      'UPDATE api_keys SET is_active = false WHERE bot_id = $1 AND user_id = $2',
      [botId, userId]
    );

    // Clear old keys from cache
    for (const row of oldKeysResult.rows) {
      await cacheService.invalidateApiKey(row.key_hash);
      logger.debug(`Cleared cached API key for bot: ${botId}`, { keyHash: row.key_hash });
    }

    // Generate new key
    const newApiKey = await this.generateApiKey(userId, botId);

    // Store in Redis cache for 24 hours
    const cacheKey = `api_key_display:${botId}`;
    await cacheService.set(cacheKey, newApiKey, 86400); // 24 hours TTL

    // Audit log: API key regenerated
    logger.info(`API key regenerated for bot: ${botId}`, {
      userId,
      botId,
      action: 'regenerate_api_key',
      oldKeysCleared: oldKeysResult.rows.length,
    });

    return newApiKey;
  }
}

export const authService = new AuthService();
