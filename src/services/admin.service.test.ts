import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../database';
import { adminService } from './admin.service';

vi.mock('../database', () => ({
  db: {
    query: vi.fn(),
  },
}));

vi.mock('../utils/redis-storage', () => ({
  redisStorage: {
    getAllWorkerHeartbeats: vi.fn(),
    getWorkerConnections: vi.fn(),
    getWorkerHeartbeat: vi.fn(),
  },
}));

describe('AdminService user management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists users with balances and bot counts from real database tables', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            email: 'user@example.com',
            role: 'user',
            emailVerified: true,
            balance: '12.50',
            totalBots: '2',
            activeBots: '1',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any);

    const result = await adminService.listUsers({ page: 1, limit: 20 });

    expect(result.users).toEqual([
      {
        id: 'user-1',
        email: 'user@example.com',
        role: 'user',
        emailVerified: true,
        balance: 12.5,
        totalBots: 2,
        activeBots: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    expect(result.total).toBe(1);
    expect(String(vi.mocked(db.query).mock.calls[0][0])).toContain('LEFT JOIN balances');
    expect(String(vi.mocked(db.query).mock.calls[0][0])).toContain('LEFT JOIN bots');
  });

  it('updates a user role only to a safe admin-manageable role', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: 'user-1', email: 'user@example.com', role: 'admin' }],
    } as any);

    const result = await adminService.updateUserRole('user-1', 'admin');

    expect(result.role).toBe('admin');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      ['admin', 'user-1']
    );
  });
});
