import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../database';
import { messageService } from './message.service';

vi.mock('../database', () => ({
  db: {
    query: vi.fn(),
  },
}));

vi.mock('./billing.service', () => ({
  billingService: {
    calculateMessageCost: vi.fn(),
    deductCost: vi.fn(),
  },
}));

vi.mock('./queue.service', () => ({
  queueService: {
    enqueueMessage: vi.fn(),
  },
}));

vi.mock('../config/metrics', () => ({
  messagesSentTotal: {
    inc: vi.fn(),
  },
}));

describe('MessageService.getMessageHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses positional SQL placeholders for filters and pagination', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'bot-123' }] } as any)
      .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    await messageService.getMessageHistory('bot-123', 'user-123', {
      direction: 'outbound',
      limit: 10,
      offset: 20,
    });

    const countSql = vi.mocked(db.query).mock.calls[1][0] as string;
    const listSql = vi.mocked(db.query).mock.calls[2][0] as string;

    expect(countSql).toContain('direction = $2');
    expect(listSql).toContain('direction = $2');
    expect(listSql).toContain('LIMIT $3 OFFSET $4');
    expect(vi.mocked(db.query).mock.calls[2][1]).toEqual(['bot-123', 'outbound', 10, 20]);
  });
});
