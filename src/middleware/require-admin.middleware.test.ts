import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { requireAdmin } from './require-admin.middleware';
import { AuthRequest } from './auth.middleware';
import { db } from '../database';

vi.mock('../database', () => ({
  db: {
    query: vi.fn(),
  },
}));

describe('requireAdmin middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let nextFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = { userId: 'user-123' };
    mockRes = {};
    nextFn = vi.fn();
  });

  it('should call next() when user is admin', async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ role: 'admin' }],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    } as any);

    await requireAdmin(
      mockReq as AuthRequest,
      mockRes as Response,
      nextFn
    );

    expect(nextFn).toHaveBeenCalledWith();
    expect(nextFn).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it('should call next() when user is owner', async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ role: 'owner' }],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    } as any);

    await requireAdmin(
      mockReq as AuthRequest,
      mockRes as Response,
      nextFn
    );

    expect(nextFn).toHaveBeenCalledWith();
    expect(nextFn).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it('should call next(error) when user is not admin', async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ role: 'user' }],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    } as any);

    await requireAdmin(
      mockReq as AuthRequest,
      mockRes as Response,
      nextFn
    );

    expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should call next(error) when user not found', async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: '',
      oid: 0,
      fields: [],
    } as any);

    await requireAdmin(
      mockReq as AuthRequest,
      mockRes as Response,
      nextFn
    );

    expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should call next(error) when userId is missing', async () => {
    mockReq.userId = undefined;

    await requireAdmin(
      mockReq as AuthRequest,
      mockRes as Response,
      nextFn
    );

    expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
  });
});
