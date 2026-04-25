import { db } from '../database';
import { AutoResponseRule } from '../types';
import { NotFoundError, ValidationError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

export class AutoResponseService {
  async createRule(
    botId: string,
    keyword: string,
    response: string
  ): Promise<AutoResponseRule> {
    if (!keyword || !response) {
      throw new ValidationError('Keyword and response are required');
    }

    const result = await db.query<AutoResponseRule>(
      `INSERT INTO auto_response_rules (bot_id, keyword, response, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, bot_id as "botId", keyword, response, is_active as "isActive", 
                 created_at as "createdAt"`,
      [botId, keyword.toLowerCase(), response, true]
    );

    logger.info(`Auto-response rule created for bot ${botId}: ${keyword}`);
    return result.rows[0];
  }

  async getRules(botId: string): Promise<AutoResponseRule[]> {
    const result = await db.query<AutoResponseRule>(
      `SELECT id, bot_id as "botId", keyword, response, is_active as "isActive", 
              created_at as "createdAt"
       FROM auto_response_rules
       WHERE bot_id = $1
       ORDER BY created_at DESC`,
      [botId]
    );

    return result.rows;
  }

  async getRule(ruleId: string, botId: string): Promise<AutoResponseRule> {
    const result = await db.query<AutoResponseRule>(
      `SELECT id, bot_id as "botId", keyword, response, is_active as "isActive", 
              created_at as "createdAt"
       FROM auto_response_rules
       WHERE id = $1 AND bot_id = $2`,
      [ruleId, botId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError(ErrorCode.BOT_NOT_FOUND, 'Auto-response rule not found');
    }

    return result.rows[0];
  }

  async updateRule(
    ruleId: string,
    botId: string,
    updates: { keyword?: string; response?: string; isActive?: boolean }
  ): Promise<AutoResponseRule> {
    // Verify rule exists
    await this.getRule(ruleId, botId);

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.keyword !== undefined) {
      setClauses.push(`keyword = $${paramIndex++}`);
      values.push(updates.keyword.toLowerCase());
    }

    if (updates.response !== undefined) {
      setClauses.push(`response = $${paramIndex++}`);
      values.push(updates.response);
    }

    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (setClauses.length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    values.push(ruleId, botId);

    const result = await db.query<AutoResponseRule>(
      `UPDATE auto_response_rules
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex++} AND bot_id = $${paramIndex++}
       RETURNING id, bot_id as "botId", keyword, response, is_active as "isActive", 
                 created_at as "createdAt"`,
      values
    );

    logger.info(`Auto-response rule updated: ${ruleId}`);
    return result.rows[0];
  }

  async deleteRule(ruleId: string, botId: string): Promise<void> {
    // Verify rule exists
    await this.getRule(ruleId, botId);

    await db.query('DELETE FROM auto_response_rules WHERE id = $1', [ruleId]);

    logger.info(`Auto-response rule deleted: ${ruleId}`);
  }

  async checkAndGetResponse(botId: string, messageText: string): Promise<string | null> {
    // Check if auto-response is enabled for bot
    const botResult = await db.query(
      'SELECT auto_response_enabled FROM bots WHERE id = $1',
      [botId]
    );

    if (botResult.rows.length === 0 || !botResult.rows[0].auto_response_enabled) {
      return null;
    }

    // Get active rules for bot
    const rules = await db.query<AutoResponseRule>(
      `SELECT keyword, response
       FROM auto_response_rules
       WHERE bot_id = $1 AND is_active = true`,
      [botId]
    );

    // Check for keyword match (case-insensitive)
    const lowerText = messageText.toLowerCase();
    for (const rule of rules.rows) {
      if (lowerText.includes(rule.keyword)) {
        logger.info(`Auto-response triggered for bot ${botId}: ${rule.keyword}`);
        return rule.response;
      }
    }

    return null;
  }
}

export const autoResponseService = new AutoResponseService();
