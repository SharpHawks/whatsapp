import amqp from 'amqplib';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SendMessageRequest } from '../types';

interface QueuedMessage {
  id: string;
  botId: string;
  userId: string;
  request: SendMessageRequest;
  attempts: number;
  queuedAt: Date;
}

interface QueueServiceOptions {
  maxConnectAttempts?: number;
  retryDelayMs?: number;
}

export class QueueService {
  private connection: any = null;
  private channel: any = null;
  private readonly queueName = config.rabbitmq.queueName;
  private readonly maxRetries = 3;
  private readonly maxConnectAttempts: number;
  private readonly retryDelayMs: number;

  private readonly deadLetterQueueName = `${config.rabbitmq.queueName}.dead`;

  constructor(options: QueueServiceOptions = {}) {
    this.maxConnectAttempts = options.maxConnectAttempts ?? parseInt(process.env.RABBITMQ_CONNECT_ATTEMPTS || '10', 10);
    this.retryDelayMs = options.retryDelayMs ?? parseInt(process.env.RABBITMQ_CONNECT_RETRY_DELAY_MS || '2000', 10);
  }

  async connect(): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxConnectAttempts; attempt++) {
      try {
        this.connection = await amqp.connect(config.rabbitmq.url);
        this.channel = await this.connection.createChannel();

        await this.channel.assertQueue(this.deadLetterQueueName, {
          durable: true,
          arguments: {
            'x-message-ttl': 604800000,
          },
        });

        await this.channel.assertQueue(this.queueName, {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': '',
            'x-dead-letter-routing-key': this.deadLetterQueueName,
            'x-message-ttl': 86400000,
          },
        });

        logger.info('Connected to RabbitMQ');
        return;
      } catch (error) {
        lastError = error;
        logger.warn(`RabbitMQ connection attempt ${attempt}/${this.maxConnectAttempts} failed`, error);

        if (attempt < this.maxConnectAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
        }
      }
    }

    logger.error('Failed to connect to RabbitMQ:', lastError);
    throw lastError;
  }

  async enqueueMessage(message: QueuedMessage): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      this.channel!.sendToQueue(this.queueName, messageBuffer, {
        persistent: true,
        contentType: 'application/json',
        headers: {
          'x-retry-count': message.attempts || 0,
        },
      });

      logger.info(`Message queued: ${message.id}`);
    } catch (error) {
      logger.error('Failed to enqueue message:', error);
      throw error;
    }
  }

  async consumeMessages(
    handler: (message: QueuedMessage) => Promise<void>
  ): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }

    try {
      await this.channel!.prefetch(1); // Process one message at a time

      this.channel!.consume(
        this.queueName,
        async (msg: any) => {
          if (!msg) return;

          try {
            const queuedMessage: QueuedMessage = JSON.parse(msg.content.toString());
            
            logger.info(`Processing message: ${queuedMessage.id}`);
            await handler(queuedMessage);
            
            // Acknowledge successful processing
            this.channel!.ack(msg);
            logger.info(`Message processed successfully: ${queuedMessage.id}`);
          } catch (error) {
            logger.error('Failed to process message:', error);
            
            const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
            
            if (retryCount < this.maxRetries) {
              // Retry with exponential backoff
              const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
              
              setTimeout(() => {
                const queuedMessage: QueuedMessage = JSON.parse(msg.content.toString());
                queuedMessage.attempts = retryCount;
                this.enqueueMessage(queuedMessage);
              }, delay);
              
              this.channel!.ack(msg);
              logger.info(`Message requeued for retry ${retryCount}: ${msg.properties.messageId}`);
            } else {
              // Max retries reached, move to dead letter queue or mark as failed
              this.channel!.nack(msg, false, false);
              logger.error(`Message failed after ${this.maxRetries} attempts`);
            }
          }
        },
        { noAck: false }
      );

      logger.info('Started consuming messages from queue');
    } catch (error) {
      logger.error('Failed to consume messages:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      logger.info('RabbitMQ connection closed');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connection || !this.channel) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const queueService = new QueueService();
