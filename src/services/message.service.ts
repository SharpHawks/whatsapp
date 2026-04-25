import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { SendMessageRequest, MessageResponse, Message } from '../types';
import { billingService } from './billing.service';
import { queueService } from './queue.service';
import { ValidationError, NotFoundError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';
import { messagesSentTotal } from '../config/metrics';

/**
 * Check if user is admin (exempt from message charges)
 */
async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const result = await db.query<{ role: string }>(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    return result.rows.length > 0 && result.rows[0].role === 'admin';
  } catch (error) {
    logger.error('Error checking user role:', error);
    return false;
  }
}

export class MessageService {
  async sendMessage(
    userId: string,
    botId: string,
    request: SendMessageRequest
  ): Promise<MessageResponse> {
    // Detect recipient type based on format
    const recipientType = this.detectRecipientType(request.to);
    
    // Validate recipient based on type
    if (recipientType === 'contact') {
      if (!this.isValidPhoneNumber(request.to)) {
        throw new ValidationError('Invalid phone number format. Use E.164 format (e.g., +1234567890)');
      }
    } else if (recipientType === 'group') {
      if (!this.isValidGroupId(request.to)) {
        throw new ValidationError('Invalid group ID format. Must end with @g.us');
      }
      
      // Validate group membership
      await this.validateGroupMembership(botId, request.to);
    } else {
      throw new ValidationError('Invalid recipient format. Use E.164 phone number or group ID (@g.us)');
    }

    // Validate message type
    const validTypes = ['text', 'image', 'video', 'document', 'audio', 'interactive'];
    if (!validTypes.includes(request.type)) {
      throw new ValidationError(`Invalid message type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate content based on type
    if (request.type === 'text' && !request.content.text) {
      throw new ValidationError('Text content is required for text messages');
    }

    if (['image', 'video', 'document', 'audio'].includes(request.type)) {
      const hasMedia = request.content.mediaId || request.content.mediaUrl || request.content.base64;
      if (!hasMedia) {
        throw new ValidationError(`Media ID, mediaUrl, or base64 is required for ${request.type} messages`);
      }
    }

    if (request.type === 'interactive' && (!request.content.text || !request.content.buttons)) {
      throw new ValidationError('Text and buttons are required for interactive messages');
    }

    // Calculate message cost
    const cost = billingService.calculateMessageCost(request.type);

    // Check if user is admin (exempt from charges)
    const adminUser = await isAdminUser(userId);

    // Only charge non-admin users
    if (!adminUser) {
      // Check and deduct balance
      await billingService.deductCost(userId, cost, `Message to ${request.to}`);
    } else {
      logger.info(`Admin user ${userId} - message sent free of charge`);
    }

    // Create message record
    const messageId = uuidv4();
    const timestamp = new Date();

    await db.query(
      `INSERT INTO messages (id, bot_id, direction, from_number, to_number, recipient_type, type, content, status, cost, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        messageId,
        botId,
        'outbound',
        '', // Will be filled when bot sends
        request.to,
        recipientType,
        request.type,
        JSON.stringify(request.content),
        'queued',
        cost,
        timestamp,
      ]
    );

    // Queue message for delivery
    await queueService.enqueueMessage({
      id: messageId,
      botId,
      userId,
      request,
      attempts: 0,
      queuedAt: timestamp,
    });

    messagesSentTotal.inc({ type: request.type, status: 'queued' });

    logger.info(`Message queued: ${messageId} for bot ${botId}`);

    return {
      messageId,
      status: 'queued',
      timestamp,
      cost,
    };
  }

  async getMessageStatus(messageId: string, userId: string): Promise<Message> {
    const result = await db.query<Message>(
      `SELECT m.id, m.bot_id as "botId", m.whatsapp_message_id as "whatsappMessageId",
              m.direction, m.from_number as "fromNumber", m.to_number as "toNumber",
              m.recipient_type as "recipientType", m.type, m.content, m.status, m.cost, 
              m.timestamp, m.updated_at as "updatedAt"
       FROM messages m
       JOIN bots b ON m.bot_id = b.id
       WHERE m.id = $1 AND b.user_id = $2`,
      [messageId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError(ErrorCode.MESSAGE_NOT_FOUND, 'Message not found');
    }

    return result.rows[0];
  }

  async getMessageHistory(
    botId: string,
    userId: string,
    filters?: {
      direction?: 'inbound' | 'outbound';
      status?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ messages: Message[]; total: number }> {
    // Verify bot ownership
    const botCheck = await db.query(
      'SELECT id FROM bots WHERE id = $1 AND user_id = $2',
      [botId, userId]
    );

    if (botCheck.rows.length === 0) {
      throw new NotFoundError(ErrorCode.BOT_NOT_FOUND, 'Bot not found');
    }

    // Build query
    const conditions: string[] = ['bot_id = $1'];
    const values: any[] = [botId];
    let paramIndex = 2;

    if (filters?.direction) {
      conditions.push(`direction = $${paramIndex++}`);
      values.push(filters.direction);
    }

    if (filters?.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters?.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      values.push(filters.startDate);
    }

    if (filters?.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM messages WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get messages with pagination
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const result = await db.query<Message>(
      `SELECT id, bot_id as "botId", whatsapp_message_id as "whatsappMessageId",
              direction, from_number as "fromNumber", to_number as "toNumber",
              recipient_type as "recipientType", type, content, status, cost, 
              timestamp, updated_at as "updatedAt"
       FROM messages
       WHERE ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    return {
      messages: result.rows,
      total,
    };
  }

  async getUserMessages(
    userId: string,
    filters?: {
      botId?: string;
      status?: string;
      type?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ messages: any[]; total: number; page: number; limit: number }> {
    // Build query
    const conditions: string[] = ['b.user_id = $1'];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (filters?.botId) {
      conditions.push(`m.bot_id = $${paramIndex++}`);
      values.push(filters.botId);
    }

    if (filters?.status) {
      conditions.push(`m.status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters?.type) {
      conditions.push(`m.type = $${paramIndex++}`);
      values.push(filters.type);
    }

    if (filters?.search) {
      conditions.push(`(m.from_number LIKE $${paramIndex} OR m.to_number LIKE $${paramIndex} OR m.content::text LIKE $${paramIndex})`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count 
       FROM messages m
       JOIN bots b ON m.bot_id = b.id
       WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get messages with pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT m.id, m.bot_id as "botId", b.name as "botName",
              m.from_number as "from", m.to_number as "to",
              m.content->>'text' as content, m.type, m.status,
              m.content->>'mediaUrl' as "mediaUrl",
              m.timestamp, m.direction
       FROM messages m
       JOIN bots b ON m.bot_id = b.id
       WHERE ${whereClause}
       ORDER BY m.timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    return {
      messages: result.rows,
      total,
      page,
      limit,
    };
  }

  private isValidPhoneNumber(phone: string): boolean {
    // E.164 format: +[country code][number]
    // Length: 8-15 digits (excluding +)
    const e164Regex = /^\+[1-9]\d{7,14}$/;
    return e164Regex.test(phone);
  }

  private isValidGroupId(groupId: string): boolean {
    // WhatsApp group ID format: [digits]@g.us or [digits]-[timestamp]@g.us
    const groupIdRegex = /^\d+(-\d+)?@g\.us$/;
    return groupIdRegex.test(groupId);
  }

  private detectRecipientType(recipient: string): 'contact' | 'group' | 'unknown' {
    if (recipient.endsWith('@g.us')) {
      return 'group';
    } else if (recipient.startsWith('+')) {
      return 'contact';
    }
    return 'unknown';
  }

  private async validateGroupMembership(botId: string, groupId: string): Promise<void> {
    try {
      // Get groups using the same logic as BotService
      const { config } = await import('../config');
      const isWorkerMode = config.worker.enabled;

      let groups: Array<{ id: string; name: string; participantCount: number; isAdmin: boolean }>;

      if (isWorkerMode) {
        // We're in worker mode - get groups directly from local manager
        logger.debug(`Getting groups locally (worker mode) for validation of bot ${botId}`);
        const { workerBaileysManager } = await import('./worker-baileys.manager');
        groups = await workerBaileysManager.getGroups(botId);
      } else {
        // We're in API mode - call worker via HTTP
        logger.debug(`Getting groups from worker via HTTP for validation of bot ${botId}`);
        const workerUrl = `http://${config.worker.hostname || 'message-worker'}:${config.worker.healthPort || 3001}/groups/${botId}`;
        
        const response = await fetch(workerUrl);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
          throw new Error(errorData.error || `Worker returned status ${response.status}`);
        }
        
        const data = await response.json() as { groups: Array<{
          id: string;
          name: string;
          participantCount: number;
          isAdmin: boolean;
        }> };
        groups = data.groups;
      }
      
      // Check if bot is a member of the group
      const isMember = groups.some(group => group.id === groupId);
      
      if (!isMember) {
        throw new ValidationError(`Bot is not a member of group ${groupId}. Please add the bot to the group first.`);
      }
      
      logger.debug(`Bot ${botId} is a member of group ${groupId}`);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      // If bot is not connected or other error, throw appropriate error
      if (error instanceof Error && error.message.includes('not connected')) {
        throw new ValidationError('Bot is not connected. Please connect the bot first.');
      }
      
      logger.error(`Error validating group membership for bot ${botId}, group ${groupId}:`, error);
      throw new ValidationError('Unable to validate group membership. Please try again.');
    }
  }
}

export const messageService = new MessageService();
