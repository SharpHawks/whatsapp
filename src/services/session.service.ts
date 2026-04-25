import { db } from '../database';
import { logger } from '../utils/logger';

interface AuthState {
  creds: any;
  keys: any;
}

export class SessionService {
  async saveAuthState(botId: string, state: AuthState): Promise<void> {
    try {
      await db.query(
        `INSERT INTO baileys_sessions (bot_id, creds, keys, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (bot_id) 
         DO UPDATE SET creds = $2, keys = $3, updated_at = CURRENT_TIMESTAMP`,
        [botId, JSON.stringify(state.creds), JSON.stringify(state.keys)]
      );
      logger.debug(`Auth state saved for bot: ${botId}`);
    } catch (error) {
      logger.error(`Failed to save auth state for bot ${botId}:`, error);
      throw error;
    }
  }

  async loadAuthState(botId: string): Promise<AuthState | null> {
    try {
      const result = await db.query(
        'SELECT creds, keys FROM baileys_sessions WHERE bot_id = $1',
        [botId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return {
        creds: JSON.parse(result.rows[0].creds),
        keys: JSON.parse(result.rows[0].keys),
      };
    } catch (error) {
      logger.error(`Failed to load auth state for bot ${botId}:`, error);
      return null;
    }
  }

  async deleteAuthState(botId: string): Promise<void> {
    try {
      await db.query('DELETE FROM baileys_sessions WHERE bot_id = $1', [botId]);
      logger.info(`Auth state deleted for bot: ${botId}`);
    } catch (error) {
      logger.error(`Failed to delete auth state for bot ${botId}:`, error);
      throw error;
    }
  }

  async hasAuthState(botId: string): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT 1 FROM baileys_sessions WHERE bot_id = $1',
        [botId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Failed to check auth state for bot ${botId}:`, error);
      return false;
    }
  }
}

export const sessionService = new SessionService();
