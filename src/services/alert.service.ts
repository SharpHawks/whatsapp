import { logger } from '../utils/logger';

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface Alert {
  level: AlertLevel;
  title: string;
  message: string;
  botId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AlertChannel {
  name: string;
  send(alert: Alert): Promise<void>;
}

/**
 * Console alert channel - logs alerts to console
 */
class ConsoleAlertChannel implements AlertChannel {
  name = 'console';

  async send(alert: Alert): Promise<void> {
    const logData = {
      level: alert.level,
      title: alert.title,
      message: alert.message,
      botId: alert.botId,
      timestamp: alert.timestamp.toISOString(),
      ...alert.metadata,
    };

    switch (alert.level) {
      case 'critical':
        logger.error(`[ALERT] ${alert.title}`, logData);
        break;
      case 'warning':
        logger.warn(`[ALERT] ${alert.title}`, logData);
        break;
      default:
        logger.info(`[ALERT] ${alert.title}`, logData);
    }
  }
}

/**
 * Alert service for managing and sending alerts
 */
export class AlertService {
  private channels: AlertChannel[] = [];
  private alertHistory: Alert[] = [];
  private readonly MAX_HISTORY = 100;
  private alertCooldowns: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 300000; // 5 minutes

  constructor() {
    // Register default console channel
    this.registerChannel(new ConsoleAlertChannel());
  }

  /**
   * Register an alert channel
   */
  registerChannel(channel: AlertChannel): void {
    this.channels.push(channel);
    logger.info(`Alert channel registered: ${channel.name}`);
  }

  /**
   * Send an alert through all registered channels
   */
  async sendAlert(alert: Alert): Promise<void> {
    // Check cooldown to prevent alert spam
    const cooldownKey = `${alert.level}:${alert.title}:${alert.botId || 'global'}`;
    const lastAlertTime = this.alertCooldowns.get(cooldownKey);
    const now = Date.now();

    if (lastAlertTime && now - lastAlertTime < this.COOLDOWN_MS) {
      logger.debug(`Alert suppressed due to cooldown: ${alert.title}`);
      return;
    }

    // Update cooldown
    this.alertCooldowns.set(cooldownKey, now);

    // Add to history
    this.alertHistory.push(alert);
    if (this.alertHistory.length > this.MAX_HISTORY) {
      this.alertHistory = this.alertHistory.slice(-this.MAX_HISTORY);
    }

    // Send through all channels
    const sendPromises = this.channels.map(async (channel) => {
      try {
        await channel.send(alert);
      } catch (error) {
        logger.error(`Failed to send alert through ${channel.name}:`, error);
      }
    });

    await Promise.all(sendPromises);
  }

  /**
   * Alert when bot fails to reconnect after max attempts
   */
  async alertMaxReconnectAttemptsReached(botId: string, attempts: number): Promise<void> {
    await this.sendAlert({
      level: 'critical',
      title: 'Bot Connection Failed',
      message: `Bot ${botId} failed to reconnect after ${attempts} attempts`,
      botId,
      timestamp: new Date(),
      metadata: {
        attempts,
        action: 'Manual intervention required',
      },
    });
  }

  /**
   * Alert when worker process crashes repeatedly
   */
  async alertWorkerCrashLoop(workerId: string, crashCount: number): Promise<void> {
    await this.sendAlert({
      level: 'critical',
      title: 'Worker Crash Loop Detected',
      message: `Worker ${workerId} has crashed ${crashCount} times in the last hour`,
      timestamp: new Date(),
      metadata: {
        workerId,
        crashCount,
        action: 'Check worker logs and investigate root cause',
      },
    });
  }

  /**
   * Alert when connection health is degraded
   */
  async alertConnectionDegraded(botId: string, reason: string): Promise<void> {
    await this.sendAlert({
      level: 'warning',
      title: 'Bot Connection Degraded',
      message: `Bot ${botId} connection health is degraded: ${reason}`,
      botId,
      timestamp: new Date(),
      metadata: {
        reason,
      },
    });
  }

  /**
   * Alert when connection is unhealthy
   */
  async alertConnectionUnhealthy(botId: string, errors: string[]): Promise<void> {
    await this.sendAlert({
      level: 'critical',
      title: 'Bot Connection Unhealthy',
      message: `Bot ${botId} connection is unhealthy with ${errors.length} recent errors`,
      botId,
      timestamp: new Date(),
      metadata: {
        errorCount: errors.length,
        recentErrors: errors.slice(-3),
      },
    });
  }

  /**
   * Alert when worker memory usage is high
   */
  async alertHighMemoryUsage(percentage: number, used: number, total: number): Promise<void> {
    await this.sendAlert({
      level: percentage > 90 ? 'critical' : 'warning',
      title: 'High Memory Usage',
      message: `Worker memory usage is at ${percentage}% (${used}MB / ${total}MB)`,
      timestamp: new Date(),
      metadata: {
        percentage,
        usedMB: used,
        totalMB: total,
        action: 'Consider restarting worker or scaling resources',
      },
    });
  }

  /**
   * Alert when multiple bots are disconnected
   */
  async alertMultipleDisconnections(count: number, total: number): Promise<void> {
    await this.sendAlert({
      level: 'critical',
      title: 'Multiple Bot Disconnections',
      message: `${count} out of ${total} bots are currently disconnected`,
      timestamp: new Date(),
      metadata: {
        disconnectedCount: count,
        totalBots: total,
        percentage: Math.round((count / total) * 100),
        action: 'Check network connectivity and WhatsApp service status',
      },
    });
  }

  /**
   * Get alert history
   */
  getAlertHistory(count: number = 50): Alert[] {
    return this.alertHistory.slice(-count);
  }

  /**
   * Clear alert cooldowns (for testing)
   */
  clearCooldowns(): void {
    this.alertCooldowns.clear();
  }
}

export const alertService = new AlertService();
