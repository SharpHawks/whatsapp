import axios from 'axios';
import crypto from 'crypto';
import { db } from '../database';
import { config } from '../config';
import { WebhookDelivery } from '../types';
import { logger } from '../utils/logger';

interface WebhookEvent {
  type: 'message.received' | 'message.status' | 'button.clicked';
  timestamp: Date;
  data: any;
}

export class WebhookService {
  private readonly maxRetries = 3;
  private readonly timeout = 10000; // 10 seconds

  async sendWebhook(botId: string, event: WebhookEvent): Promise<WebhookDelivery> {
    // Get bot webhook URL
    const botResult = await db.query(
      'SELECT webhook_url FROM bots WHERE id = $1',
      [botId]
    );

    if (botResult.rows.length === 0 || !botResult.rows[0].webhook_url) {
      logger.debug(`No webhook URL configured for bot ${botId}`);
      throw new Error('No webhook URL configured');
    }

    const webhookUrl = botResult.rows[0].webhook_url;

    // Create webhook delivery record
    const deliveryResult = await db.query<WebhookDelivery>(
      `INSERT INTO webhook_deliveries (bot_id, event_type, event_data, url, attempts, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, bot_id as "botId", event_type as "eventType", event_data as "eventData",
                 url, attempts, status, last_attempt_at as "lastAttemptAt", 
                 response_code as "responseCode", created_at as "createdAt"`,
      [botId, event.type, JSON.stringify(event.data), webhookUrl, 0, 'pending']
    );

    const delivery = deliveryResult.rows[0];

    // Send webhook asynchronously
    this.deliverWebhook(delivery.id, webhookUrl, event).catch((error) => {
      logger.error(`Failed to deliver webhook ${delivery.id}:`, error);
    });

    return delivery;
  }

  private async deliverWebhook(
    deliveryId: string,
    url: string,
    event: WebhookEvent
  ): Promise<void> {
    try {
      // Generate signature
      const signature = this.generateSignature(event);

      // Send webhook
      const response = await axios.post(url, event, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event.type,
        },
      });

      // Update delivery status
      await db.query(
        `UPDATE webhook_deliveries
         SET status = $1, attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP, response_code = $2
         WHERE id = $3`,
        ['delivered', response.status, deliveryId]
      );

      logger.info(`Webhook delivered successfully: ${deliveryId}`);
    } catch (error: any) {
      const responseCode = error.response?.status || 0;
      
      // Get current attempts
      const result = await db.query(
        'SELECT attempts FROM webhook_deliveries WHERE id = $1',
        [deliveryId]
      );
      
      const currentAttempts = result.rows[0]?.attempts || 0;

      if (currentAttempts + 1 < this.maxRetries) {
        // Schedule retry with exponential backoff
        const delay = Math.pow(2, currentAttempts + 1) * 1000; // 2s, 4s, 8s
        
        await db.query(
          `UPDATE webhook_deliveries
           SET attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP, response_code = $1
           WHERE id = $2`,
          [responseCode, deliveryId]
        );

        logger.info(`Scheduling webhook retry ${currentAttempts + 1} for ${deliveryId} in ${delay}ms`);
        
        setTimeout(() => {
          this.deliverWebhook(deliveryId, url, event);
        }, delay);
      } else {
        // Max retries reached
        await db.query(
          `UPDATE webhook_deliveries
           SET status = $1, attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP, response_code = $2
           WHERE id = $3`,
          ['failed', responseCode, deliveryId]
        );

        logger.error(`Webhook delivery failed after ${this.maxRetries} attempts: ${deliveryId}`);
      }
    }
  }

  async retryFailedWebhook(deliveryId: string): Promise<void> {
    const result = await db.query<WebhookDelivery>(
      `SELECT id, bot_id as "botId", event_type as "eventType", event_data as "eventData", url
       FROM webhook_deliveries
       WHERE id = $1 AND status = 'failed'`,
      [deliveryId]
    );

    if (result.rows.length === 0) {
      throw new Error('Webhook delivery not found or not in failed status');
    }

    const delivery = result.rows[0];
    const event: WebhookEvent = {
      type: delivery.eventType as any,
      timestamp: new Date(),
      data: delivery.eventData,
    };

    // Reset attempts and retry
    await db.query(
      'UPDATE webhook_deliveries SET attempts = 0, status = $1 WHERE id = $2',
      ['pending', deliveryId]
    );

    await this.deliverWebhook(deliveryId, delivery.url, event);
  }

  async getWebhookHistory(
    botId: string,
    filters?: { status?: string; limit?: number; offset?: number }
  ): Promise<{ deliveries: WebhookDelivery[]; total: number }> {
    const conditions: string[] = ['bot_id = $1'];
    const values: any[] = [botId];
    let paramIndex = 2;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM webhook_deliveries WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get deliveries with pagination
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const result = await db.query<WebhookDelivery>(
      `SELECT id, bot_id as "botId", event_type as "eventType", event_data as "eventData",
              url, attempts, status, last_attempt_at as "lastAttemptAt", 
              response_code as "responseCode", created_at as "createdAt"
       FROM webhook_deliveries
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    return {
      deliveries: result.rows,
      total,
    };
  }

  private generateSignature(event: WebhookEvent): string {
    const secret = config.jwt.secret; // Use JWT secret as webhook secret
    const payload = JSON.stringify(event);
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  static verifySignature(payload: string, signature: string): boolean {
    const secret = config.jwt.secret;
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }
}

export const webhookService = new WebhookService();
