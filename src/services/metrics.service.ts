import { logger } from '../utils/logger';

interface ConnectionMetric {
  botId: string;
  event: 'connect' | 'disconnect' | 'reconnect' | 'failed';
  timestamp: Date;
  duration?: number; // milliseconds
  attempt?: number;
  error?: string;
}

interface MetricsSummary {
  totalConnections: number;
  totalDisconnections: number;
  totalReconnections: number;
  totalFailures: number;
  averageReconnectionTime: number;
  failureRate: number;
}

export class MetricsService {
  private metrics: ConnectionMetric[] = [];
  private readonly MAX_METRICS = 1000; // Keep last 1000 metrics
  private connectionStartTimes: Map<string, Date> = new Map();

  /**
   * Log connection event
   */
  logConnectionEvent(
    botId: string,
    event: 'connect' | 'disconnect' | 'reconnect' | 'failed',
    options?: {
      attempt?: number;
      error?: string;
    }
  ): void {
    const timestamp = new Date();
    let duration: number | undefined;

    // Calculate duration for reconnect events
    if (event === 'reconnect' || event === 'connect') {
      const startTime = this.connectionStartTimes.get(botId);
      if (startTime) {
        duration = timestamp.getTime() - startTime.getTime();
        this.connectionStartTimes.delete(botId);
      }
    }

    // Store start time for connection attempts
    if (event === 'connect' && !this.connectionStartTimes.has(botId)) {
      this.connectionStartTimes.set(botId, timestamp);
    }

    const metric: ConnectionMetric = {
      botId,
      event,
      timestamp,
      duration,
      attempt: options?.attempt,
      error: options?.error,
    };

    this.metrics.push(metric);

    // Keep only last MAX_METRICS
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log the event
    const logData: any = {
      botId,
      event,
      timestamp: timestamp.toISOString(),
    };

    if (duration !== undefined) {
      logData.duration = `${duration}ms`;
    }

    if (options?.attempt !== undefined) {
      logData.attempt = options.attempt;
    }

    if (options?.error) {
      logData.error = options.error;
    }

    if (event === 'failed') {
      logger.error('Connection event:', logData);
    } else {
      logger.info('Connection event:', logData);
    }
  }

  /**
   * Get metrics summary
   */
  getSummary(timeWindowMs?: number): MetricsSummary {
    const now = Date.now();
    const metricsToAnalyze = timeWindowMs
      ? this.metrics.filter(m => now - m.timestamp.getTime() <= timeWindowMs)
      : this.metrics;

    const totalConnections = metricsToAnalyze.filter(m => m.event === 'connect').length;
    const totalDisconnections = metricsToAnalyze.filter(m => m.event === 'disconnect').length;
    const totalReconnections = metricsToAnalyze.filter(m => m.event === 'reconnect').length;
    const totalFailures = metricsToAnalyze.filter(m => m.event === 'failed').length;

    // Calculate average reconnection time
    const reconnectMetrics = metricsToAnalyze.filter(
      m => (m.event === 'reconnect' || m.event === 'connect') && m.duration !== undefined
    );
    const averageReconnectionTime =
      reconnectMetrics.length > 0
        ? reconnectMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / reconnectMetrics.length
        : 0;

    // Calculate failure rate
    const totalAttempts = totalConnections + totalReconnections + totalFailures;
    const failureRate = totalAttempts > 0 ? (totalFailures / totalAttempts) * 100 : 0;

    return {
      totalConnections,
      totalDisconnections,
      totalReconnections,
      totalFailures,
      averageReconnectionTime: Math.round(averageReconnectionTime),
      failureRate: Math.round(failureRate * 100) / 100,
    };
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count: number = 50): ConnectionMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Get metrics for specific bot
   */
  getBotMetrics(botId: string, count: number = 50): ConnectionMetric[] {
    return this.metrics.filter(m => m.botId === botId).slice(-count);
  }

  /**
   * Log periodic summary
   */
  logSummary(timeWindowMs?: number): void {
    const summary = this.getSummary(timeWindowMs);
    const timeWindow = timeWindowMs ? `last ${timeWindowMs / 1000}s` : 'all time';

    logger.info(`Connection metrics summary (${timeWindow}):`, {
      totalConnections: summary.totalConnections,
      totalDisconnections: summary.totalDisconnections,
      totalReconnections: summary.totalReconnections,
      totalFailures: summary.totalFailures,
      averageReconnectionTime: `${summary.averageReconnectionTime}ms`,
      failureRate: `${summary.failureRate}%`,
    });
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(olderThanMs: number): void {
    const cutoffTime = Date.now() - olderThanMs;
    const initialCount = this.metrics.length;

    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoffTime);

    const removedCount = initialCount - this.metrics.length;
    if (removedCount > 0) {
      logger.debug(`Cleared ${removedCount} old metrics`);
    }
  }
}

export const metricsService = new MetricsService();
