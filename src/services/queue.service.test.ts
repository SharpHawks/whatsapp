import amqp from 'amqplib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueService } from './queue.service';

vi.mock('amqplib', () => ({
  default: {
    connect: vi.fn(),
  },
}));

describe('QueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries RabbitMQ connection when AMQP listener is not ready yet', async () => {
    const channel = {
      assertQueue: vi.fn().mockResolvedValue(undefined),
    };
    const connection = {
      createChannel: vi.fn().mockResolvedValue(channel),
    };

    vi.mocked(amqp.connect)
      .mockRejectedValueOnce(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }))
      .mockResolvedValueOnce(connection as any);

    const queueService = new QueueService({ retryDelayMs: 1, maxConnectAttempts: 2 });

    await queueService.connect();

    expect(amqp.connect).toHaveBeenCalledTimes(2);
    expect(connection.createChannel).toHaveBeenCalledTimes(1);
    expect(channel.assertQueue).toHaveBeenCalledTimes(2);
  });
});
