import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

// Event handler interfaces
export interface BotEventHandler {
  onBotConnect?(botId: string): Promise<void>;
  onBotDisconnect?(botId: string): Promise<void>;
  onQRGenerated?(botId: string): Promise<void>;
  onBotConnected?(botId: string, phoneNumber: string): Promise<void>;
  onBotDisconnected?(botId: string): Promise<void>;
  onConnectionLost?(botId: string, reason: string): Promise<void>;
}

export interface WorkerEventHandler {
  onWorkerStarted?(workerId: string): Promise<void>;
  onWorkerReady?(workerId: string, connectionCount: number): Promise<void>;
}

// Event message types
interface BotConnectEvent {
  type: 'bot:connect';
  botId: string;
  timestamp: number;
}

interface BotDisconnectEvent {
  type: 'bot:disconnect';
  botId: string;
  timestamp: number;
}

interface QRGeneratedEvent {
  type: 'qr:generated';
  botId: string;
  timestamp: number;
}

interface BotConnectedEvent {
  type: 'bot:connected';
  botId: string;
  phoneNumber: string;
  timestamp: number;
}

interface BotDisconnectedEvent {
  type: 'bot:disconnected';
  botId: string;
  timestamp: number;
}

interface ConnectionLostEvent {
  type: 'bot:connection_lost';
  botId: string;
  reason: string;
  timestamp: number;
}

interface WorkerStartedEvent {
  type: 'worker:started';
  workerId: string;
  timestamp: number;
}

interface WorkerReadyEvent {
  type: 'worker:ready';
  workerId: string;
  connectionCount: number;
  timestamp: number;
}

interface WorkerStoppedEvent {
  type: 'worker:stopped';
  workerId: string;
  timestamp: number;
}

type PubSubEvent =
  | BotConnectEvent
  | BotDisconnectEvent
  | QRGeneratedEvent
  | BotConnectedEvent
  | BotDisconnectedEvent
  | ConnectionLostEvent
  | WorkerStartedEvent
  | WorkerReadyEvent
  | WorkerStoppedEvent;

// Queued event for handling disconnections
interface QueuedEvent {
  channel: string;
  message: string;
  timestamp: number;
}

export class RedisPubSubService {
  private publisher: RedisClientType;
  private subscriber: RedisClientType;
  private isConnected: boolean = false;
  private eventQueue: QueuedEvent[] = [];
  private readonly MAX_QUEUE_SIZE = 1000;
  private botEventHandler: BotEventHandler | null = null;
  private workerEventHandler: WorkerEventHandler | null = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Create separate clients for publishing and subscribing
    this.publisher = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    this.subscriber = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Publisher event handlers
    this.publisher.on('error', (err) => {
      logger.error('Redis PubSub Publisher error:', err);
    });

    this.publisher.on('connect', () => {
      logger.info('Redis PubSub Publisher connected');
    });

    this.publisher.on('ready', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('Redis PubSub Publisher ready');
      this.flushEventQueue();
    });

    this.publisher.on('disconnect', () => {
      logger.warn('Redis PubSub Publisher disconnected');
      this.isConnected = false;
    });

    this.publisher.on('reconnecting', () => {
      logger.info('Redis PubSub Publisher reconnecting...');
    });

    // Subscriber event handlers
    this.subscriber.on('error', (err) => {
      logger.error('Redis PubSub Subscriber error:', err);
    });

    this.subscriber.on('connect', () => {
      logger.info('Redis PubSub Subscriber connected');
    });

    this.subscriber.on('ready', () => {
      logger.info('Redis PubSub Subscriber ready');
    });

    this.subscriber.on('disconnect', () => {
      logger.warn('Redis PubSub Subscriber disconnected');
    });

    this.subscriber.on('reconnecting', () => {
      logger.info('Redis PubSub Subscriber reconnecting...');
    });
  }

  async connect(): Promise<void> {
    try {
      if (!this.publisher.isOpen) {
        await this.publisher.connect();
      }
      if (!this.subscriber.isOpen) {
        await this.subscriber.connect();
      }
      this.isConnected = true;
      logger.info('Redis PubSub Service connected');
    } catch (error) {
      logger.error('Failed to connect Redis PubSub Service:', error);
      await this.handleReconnect();
      throw error;
    }
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max reconnection attempts reached for Redis PubSub');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    logger.info(`Attempting to reconnect Redis PubSub in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error('Reconnection attempt failed:', error);
      }
    }, delay);
  }

  async disconnect(): Promise<void> {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      await this.unsubscribeAll();
      
      if (this.publisher.isOpen) {
        await this.publisher.disconnect();
      }
      if (this.subscriber.isOpen) {
        await this.subscriber.disconnect();
      }
      
      this.isConnected = false;
      logger.info('Redis PubSub Service disconnected');
    } catch (error) {
      logger.error('Error disconnecting Redis PubSub Service:', error);
    }
  }

  private async publish(channel: string, event: PubSubEvent): Promise<void> {
    const message = JSON.stringify(event);

    if (!this.isConnected || !this.publisher.isOpen) {
      if (this.eventQueue.length < this.MAX_QUEUE_SIZE) {
        this.eventQueue.push({ channel, message, timestamp: Date.now() });
        logger.warn(`Redis disconnected, queued event: ${channel} (queue size: ${this.eventQueue.length})`);
      } else {
        logger.error(`Event queue full (${this.MAX_QUEUE_SIZE}), dropping event: ${channel}`);
      }
      return;
    }

    try {
      await this.publisher.publish(channel, message);
      logger.debug(`Published event to ${channel}:`, event);
    } catch (error) {
      logger.error(`Failed to publish event to ${channel}:`, error);
      
      // Queue the event for retry
      if (this.eventQueue.length < this.MAX_QUEUE_SIZE) {
        this.eventQueue.push({ channel, message, timestamp: Date.now() });
      }
      
      throw error;
    }
  }

  private async flushEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    logger.info(`Flushing ${this.eventQueue.length} queued events`);
    
    const events = [...this.eventQueue];
    this.eventQueue = [];

    for (const event of events) {
      try {
        await this.publisher.publish(event.channel, event.message);
        logger.debug(`Flushed queued event to ${event.channel}`);
      } catch (error) {
        logger.error(`Failed to flush event to ${event.channel}:`, error);
        // Re-queue if still under limit
        if (this.eventQueue.length < this.MAX_QUEUE_SIZE) {
          this.eventQueue.push(event);
        }
      }
    }

    if (this.eventQueue.length > 0) {
      logger.warn(`${this.eventQueue.length} events remain in queue after flush`);
    }
  }

  // Bot lifecycle event publishing methods
  async publishBotConnect(botId: string): Promise<void> {
    await this.publish('bot:connect', {
      type: 'bot:connect',
      botId,
      timestamp: Date.now(),
    });
  }

  async publishBotDisconnect(botId: string): Promise<void> {
    await this.publish('bot:disconnect', {
      type: 'bot:disconnect',
      botId,
      timestamp: Date.now(),
    });
  }

  async publishQRGenerated(botId: string): Promise<void> {
    await this.publish('qr:generated', {
      type: 'qr:generated',
      botId,
      timestamp: Date.now(),
    });
  }

  async publishBotConnected(botId: string, phoneNumber: string): Promise<void> {
    await this.publish('bot:connected', {
      type: 'bot:connected',
      botId,
      phoneNumber,
      timestamp: Date.now(),
    });
  }

  async publishBotDisconnected(botId: string): Promise<void> {
    await this.publish('bot:disconnected', {
      type: 'bot:disconnected',
      botId,
      timestamp: Date.now(),
    });
  }

  async publishConnectionLost(botId: string, reason: string): Promise<void> {
    await this.publish('bot:connection_lost', {
      type: 'bot:connection_lost',
      botId,
      reason,
      timestamp: Date.now(),
    });
  }

  // Worker lifecycle event publishing methods
  async publishWorkerStarted(workerId: string): Promise<void> {
    await this.publish('worker:started', {
      type: 'worker:started',
      workerId,
      timestamp: Date.now(),
    });
  }

  async publishWorkerReady(workerId: string, connectionCount: number): Promise<void> {
    await this.publish('worker:ready', {
      type: 'worker:ready',
      workerId,
      connectionCount,
      timestamp: Date.now(),
    });
  }

  async publishWorkerStopped(workerId: string): Promise<void> {
    await this.publish('worker:stopped', {
      type: 'worker:stopped',
      workerId,
      timestamp: Date.now(),
    });
  }

  // Subscribe to bot events
  async subscribeBotEvents(handler: BotEventHandler): Promise<void> {
    this.botEventHandler = handler;

    const channels = [
      'bot:connect',
      'bot:disconnect',
      'qr:generated',
      'bot:connected',
      'bot:disconnected',
      'bot:connection_lost',
    ];

    for (const channel of channels) {
      await this.subscriber.subscribe(channel, async (message) => {
        try {
          const event = JSON.parse(message) as PubSubEvent;
          await this.handleBotEvent(event);
        } catch (error) {
          logger.error(`Error handling bot event from ${channel}:`, error);
        }
      });
    }

    logger.info('Subscribed to bot events');
  }

  // Subscribe to worker events
  async subscribeWorkerEvents(handler: WorkerEventHandler): Promise<void> {
    this.workerEventHandler = handler;

    const channels = ['worker:started', 'worker:ready'];

    for (const channel of channels) {
      await this.subscriber.subscribe(channel, async (message) => {
        try {
          const event = JSON.parse(message) as PubSubEvent;
          await this.handleWorkerEvent(event);
        } catch (error) {
          logger.error(`Error handling worker event from ${channel}:`, error);
        }
      });
    }

    logger.info('Subscribed to worker events');
  }

  private async handleBotEvent(event: PubSubEvent): Promise<void> {
    if (!this.botEventHandler) {
      return;
    }

    try {
      switch (event.type) {
        case 'bot:connect':
          if (this.botEventHandler.onBotConnect) {
            await this.botEventHandler.onBotConnect(event.botId);
          }
          break;

        case 'bot:disconnect':
          if (this.botEventHandler.onBotDisconnect) {
            await this.botEventHandler.onBotDisconnect(event.botId);
          }
          break;

        case 'qr:generated':
          if (this.botEventHandler.onQRGenerated) {
            await this.botEventHandler.onQRGenerated(event.botId);
          }
          break;

        case 'bot:connected':
          if (this.botEventHandler.onBotConnected) {
            await this.botEventHandler.onBotConnected(event.botId, event.phoneNumber);
          }
          break;

        case 'bot:disconnected':
          if (this.botEventHandler.onBotDisconnected) {
            await this.botEventHandler.onBotDisconnected(event.botId);
          }
          break;

        case 'bot:connection_lost':
          if (this.botEventHandler.onConnectionLost) {
            await this.botEventHandler.onConnectionLost(event.botId, event.reason);
          }
          break;
      }
    } catch (error) {
      logger.error(`Error in bot event handler for ${event.type}:`, error);
    }
  }

  private async handleWorkerEvent(event: PubSubEvent): Promise<void> {
    if (!this.workerEventHandler) {
      return;
    }

    try {
      switch (event.type) {
        case 'worker:started':
          if (this.workerEventHandler.onWorkerStarted) {
            await this.workerEventHandler.onWorkerStarted(event.workerId);
          }
          break;

        case 'worker:ready':
          if (this.workerEventHandler.onWorkerReady) {
            await this.workerEventHandler.onWorkerReady(event.workerId, event.connectionCount);
          }
          break;
      }
    } catch (error) {
      logger.error(`Error in worker event handler for ${event.type}:`, error);
    }
  }

  // Unsubscribe from all channels
  async unsubscribeAll(): Promise<void> {
    try {
      if (this.subscriber.isOpen) {
        await this.subscriber.unsubscribe();
        logger.info('Unsubscribed from all channels');
      }
      this.botEventHandler = null;
      this.workerEventHandler = null;
    } catch (error) {
      logger.error('Error unsubscribing from channels:', error);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.publisher.isOpen || !this.subscriber.isOpen) {
        return false;
      }
      await this.publisher.ping();
      await this.subscriber.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get queue status
  getQueueStatus(): { size: number; maxSize: number; isConnected: boolean } {
    return {
      size: this.eventQueue.length,
      maxSize: this.MAX_QUEUE_SIZE,
      isConnected: this.isConnected,
    };
  }
}

export const redisPubSubService = new RedisPubSubService();
