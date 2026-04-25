import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../database';
import { cacheService } from './cache.service';

vi.mock('../database', () => ({
  db: {
    query: vi.fn(),
  },
}));

vi.mock('./cache.service', () => ({
  cacheService: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    invalidateApiKey: vi.fn(),
  },
}));

const encryptForTest = (plainText: string, secret: string) => {
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
};

describe('AuthService API key reveal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_KEY_ENCRYPTION_SECRET = 'test-secret-for-api-key-encryption';
  });

  it('reveals the active bot API key from encrypted database storage when display cache expired', async () => {
    const apiKey = 'sk_1234567890abcdef';
    const encryptedKey = encryptForTest(apiKey, process.env.API_KEY_ENCRYPTION_SECRET!);
    vi.mocked(cacheService.get).mockResolvedValue(null);
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ encryptedKey }],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    } as any);

    const { authService } = await import('./auth.service');

    await expect(authService.revealApiKey('bot-123', 'user-123')).resolves.toBe(apiKey);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('encrypted_key'),
      ['bot-123', 'user-123']
    );
  });
});
