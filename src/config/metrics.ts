import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'whatsapp_api_' });

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Длительность HTTP запросов',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const messagesSentTotal = new client.Counter({
  name: 'whatsapp_messages_sent_total',
  help: 'Отправленные WhatsApp сообщения',
  labelNames: ['type', 'status'],
  registers: [register],
});

export const activeConnectionsGauge = new client.Gauge({
  name: 'whatsapp_active_connections',
  help: 'Активные WhatsApp подключения',
  registers: [register],
});

export function getMetrics(): Promise<string> {
  return register.metrics();
}

export function getContentType(): string {
  return register.contentType;
}
