import { proto } from '@whiskeysockets/baileys';
import { db } from '../database';
import { logger } from '../utils/logger';
import { MessageContent } from '../types';

export class MessageHandlerService {
  async handleIncomingMessage(botId: string, message: proto.IWebMessageInfo): Promise<void> {
    try {
      if (!message.message || !message.key.remoteJid) {
        return;
      }

      const messageType = Object.keys(message.message)[0];
      const from = message.key.remoteJid.replace('@s.whatsapp.net', '');
      const messageId = message.key.id;

      // Extract message content based on type
      const content = this.extractMessageContent(message.message, messageType);

      // Store message in database
      await db.query(
        `INSERT INTO messages (bot_id, whatsapp_message_id, direction, from_number, to_number, type, content, status, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          botId,
          messageId,
          'inbound',
          from,
          '', // Bot's number will be filled later
          this.mapMessageType(messageType),
          JSON.stringify(content),
          'received',
          new Date(message.messageTimestamp as number * 1000),
        ]
      );

      logger.info(`Incoming message stored for bot ${botId}: ${messageId}`);

      // Trigger webhook notification
      const { webhookService } = await import('./webhook.service');
      await webhookService.sendWebhook(botId, {
        type: 'message.received',
        timestamp: new Date(),
        data: {
          messageId,
          from,
          type: this.mapMessageType(messageType),
          content,
          timestamp: message.messageTimestamp,
        },
      });

      // Check for auto-response
      if (content.text) {
        const { autoResponseService } = await import('./auto-response.service');
        const autoResponse = await autoResponseService.checkAndGetResponse(botId, content.text);
        
        if (autoResponse) {
          const { baileysManager } = await import('./baileys.service');
          const sock = await baileysManager.getConnection(botId);
          if (sock) {
            await sock.sendMessage(message.key.remoteJid!, { text: autoResponse });
            logger.info(`Auto-response sent for bot ${botId}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to handle incoming message for bot ${botId}:`, error);
    }
  }

  async handleMessageStatusUpdate(
    botId: string,
    updates: { key: proto.IMessageKey; update: Partial<proto.IWebMessageInfo> }[]
  ): Promise<void> {
    try {
      for (const { key, update } of updates) {
        const messageId = key.id;
        const status = this.mapStatus(update);

        if (status) {
          await db.query(
            'UPDATE messages SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE whatsapp_message_id = $2 AND bot_id = $3',
            [status, messageId, botId]
          );

          logger.debug(`Message status updated for bot ${botId}: ${messageId} -> ${status}`);

          // Trigger webhook notification
          const { webhookService } = await import('./webhook.service');
          await webhookService.sendWebhook(botId, {
            type: 'message.status',
            timestamp: new Date(),
            data: {
              messageId,
              status,
            },
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to handle message status updates for bot ${botId}:`, error);
    }
  }

  private extractMessageContent(message: proto.IMessage, messageType: string): MessageContent {
    const content: MessageContent = {};

    switch (messageType) {
      case 'conversation':
        content.text = message.conversation || undefined;
        break;

      case 'extendedTextMessage':
        content.text = message.extendedTextMessage?.text || undefined;
        break;

      case 'imageMessage':
        content.caption = message.imageMessage?.caption || undefined;
        // Media URL would be downloaded and stored separately
        break;

      case 'videoMessage':
        content.caption = message.videoMessage?.caption || undefined;
        break;

      case 'documentMessage':
        content.caption = message.documentMessage?.caption || undefined;
        break;

      case 'audioMessage':
        // Audio messages don't have captions
        break;

      case 'buttonsResponseMessage':
        content.text = message.buttonsResponseMessage?.selectedButtonId || undefined;
        break;

      default:
        logger.warn(`Unknown message type: ${messageType}`);
    }

    return content;
  }

  private mapMessageType(baileysType: string): string {
    const typeMap: Record<string, string> = {
      conversation: 'text',
      extendedTextMessage: 'text',
      imageMessage: 'image',
      videoMessage: 'video',
      documentMessage: 'document',
      audioMessage: 'audio',
      buttonsResponseMessage: 'interactive',
    };

    return typeMap[baileysType] || 'text';
  }

  private mapStatus(update: Partial<proto.IWebMessageInfo>): string | null {
    if (update.status === proto.WebMessageInfo.Status.DELIVERY_ACK) {
      return 'delivered';
    } else if (update.status === proto.WebMessageInfo.Status.READ) {
      return 'read';
    } else if (update.status === proto.WebMessageInfo.Status.SERVER_ACK) {
      return 'sent';
    } else if (update.status === proto.WebMessageInfo.Status.ERROR) {
      return 'failed';
    }

    return null;
  }
}

export const messageHandlerService = new MessageHandlerService();
