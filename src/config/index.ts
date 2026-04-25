import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
const apiKeyEncryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET;

if (isProduction) {
  const weakSecrets = ['change_this_secret', 'change_this_refresh_secret', 'your_jwt_secret_change_in_production', 'your_refresh_secret_change_in_production', 'dev_secret_change_in_production', 'dev_refresh_change_in_production', 'dev_api_key_encryption_change_in_production'];
  if (!jwtSecret || weakSecrets.includes(jwtSecret)) {
    throw new Error('JWT_SECRET must be set to a strong random value in production. Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  }
  if (!jwtRefreshSecret || weakSecrets.includes(jwtRefreshSecret)) {
    throw new Error('JWT_REFRESH_SECRET must be set to a strong random value in production. Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  }
  if (!apiKeyEncryptionSecret || weakSecrets.includes(apiKeyEncryptionSecret)) {
    throw new Error('API_KEY_ENCRYPTION_SECRET must be set to a stable strong random value in production. Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  }
}

export const config = {
  server: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiVersion: process.env.API_VERSION || 'v1',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'whatsapp_api',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '6000', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || (process.env.NODE_ENV === 'production' ? undefined : undefined),
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  security: {
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    enableHttpsRedirect: process.env.ENABLE_HTTPS_REDIRECT === 'true',
  },
  jwt: {
    secret: jwtSecret || 'change_this_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: jwtRefreshSecret || 'change_this_refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  apiKeys: {
    encryptionSecret: apiKeyEncryptionSecret || jwtSecret || 'change_this_secret',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    queueName: process.env.RABBITMQ_QUEUE_NAME || 'whatsapp_messages',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    currency: process.env.STRIPE_CURRENCY || 'EUR',
  },
  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    from: process.env.EMAIL_FROM || 'noreply@example.com',
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'eu-central-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'whatsapp-media-files',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  pricing: {
    text: parseFloat(process.env.PRICE_TEXT || '0.05'),
    image: parseFloat(process.env.PRICE_IMAGE || '0.10'),
    video: parseFloat(process.env.PRICE_VIDEO || '0.20'),
    document: parseFloat(process.env.PRICE_DOCUMENT || '0.10'),
    audio: parseFloat(process.env.PRICE_AUDIO || '0.10'),
    interactive: parseFloat(process.env.PRICE_INTERACTIVE || '0.15'),
  },
  withdrawal: {
    minAmount: parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT || '100'),
    feePercent: parseFloat(process.env.WITHDRAWAL_FEE_PERCENT || '2'),
  },
  baileys: {
    sessionPath: process.env.BAILEYS_SESSION_PATH || './sessions',
    /** When a separate process runs Baileys (e.g. message-worker), the API must not open the same session files. */
    skipRestore: process.env.SKIP_BAILEYS_RESTORE === 'true',
  },
  worker: {
    enabled: process.env.WORKER_ENABLED === 'true',
    hostname: process.env.WORKER_HOSTNAME || 'message-worker',
    healthCheckInterval: parseInt(process.env.WORKER_HEALTH_CHECK_INTERVAL || '30000', 10),
    heartbeatInterval: parseInt(process.env.WORKER_HEARTBEAT_INTERVAL || '10000', 10),
    shutdownTimeout: parseInt(process.env.SHUTDOWN_TIMEOUT || '30000', 10),
    healthPort: parseInt(process.env.WORKER_HEALTH_PORT || '3001', 10),
  },
  lock: {
    ttl: parseInt(process.env.REDIS_LOCK_TTL || '30000', 10),
  },
  socket: {
    path: process.env.SOCKET_PATH || '/socket.io',
    corsOrigins:
      process.env.SOCKETIO_CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ||
      process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ||
      [],
    useRedisAdapter: process.env.SOCKETIO_REDIS_ADAPTER === 'true',
  },
};
