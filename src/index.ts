import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { initializeServices, shutdownServices } from './startup';
const app = express();
const isStripeWebhookRequest = (req: express.Request) =>
  req.originalUrl.split('?')[0] === `/api/${config.server.apiVersion}/billing/webhook`;

// Compression
app.use(compression({ level: 6, threshold: 1024 }));

// Trust proxy (for HTTPS redirect and rate limiting)
app.set('trust proxy', 1);

// HTTPS redirect (production only)
import { httpsRedirectMiddleware } from './middleware/https-redirect.middleware';
app.use(httpsRedirectMiddleware);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // In production, check against whitelist
    if (config.server.env === 'production') {
      const whitelist =
        process.env.CORS_ORIGINS?.split(',')
          .map((o) => o.trim())
          .filter(Boolean) || [];
      if (whitelist.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
};

app.use(cors(corsOptions));
app.use(`/api/${config.server.apiVersion}/billing/webhook`, express.raw({ type: 'application/json' }));
app.use((req, res, next) => (
  isStripeWebhookRequest(req) ? next() : express.json({ limit: '10mb' })(req, res, next)
));
app.use((req, res, next) => (
  isStripeWebhookRequest(req) ? next() : express.urlencoded({ extended: true, limit: '10mb' })(req, res, next)
));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  
  next();
});

// Input validation and sanitization
import { sanitizeInputs, validateCommonParams } from './middleware/input-validation.middleware';
import { metricsMiddleware } from './middleware/metrics.middleware';
app.use((req, res, next) => (isStripeWebhookRequest(req) ? next() : sanitizeInputs(req, res, next)));
app.use((req, res, next) => (isStripeWebhookRequest(req) ? next() : validateCommonParams(req, res, next)));
app.use(metricsMiddleware);

// API documentation (Swagger)
import docsRoutes from './routes/docs.routes';
import { getMetrics, getContentType, activeConnectionsGauge } from './config/metrics';

app.use('/api-docs', docsRoutes);

// Prometheus metrics
app.get('/metrics', async (_req, res) => {
  try {
    // Update active connections gauge from DB
    try {
      const { db } = await import('./database');
      const result = await db.query<{ count: string }>(
        "SELECT COUNT(*) as count FROM bots WHERE connection_status = 'connected'"
      );
      activeConnectionsGauge.set(parseInt(result.rows[0]?.count ?? '0', 10));
    } catch {
      // Ignore - metrics still work without connection count
    }

    res.set('Content-Type', getContentType());
    res.end(await getMetrics());
  } catch (error) {
    res.status(500).end();
  }
});

// Health check endpoints
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness check - verifies all dependencies (DB, Redis, RabbitMQ)
app.get('/health/ready', async (_req, res) => {
  const checks: Record<string, { status: string; latencyMs?: number }> = {};
  let allHealthy = true;

  try {
    const { db } = await import('./database');
    const { cacheService } = await import('./services/cache.service');
    const { queueService } = await import('./services/queue.service');

    const dbStart = Date.now();
    const dbOk = await db.healthCheck();
    checks.database = {
      status: dbOk ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - dbStart,
    };
    if (!dbOk) allHealthy = false;

    const redisStart = Date.now();
    const redisOk = await cacheService.healthCheck();
    checks.redis = {
      status: redisOk ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - redisStart,
    };
    if (!redisOk) allHealthy = false;

    const rabbitStart = Date.now();
    const rabbitOk = await queueService.healthCheck();
    checks.rabbitmq = {
      status: rabbitOk ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - rabbitStart,
    };
    if (!rabbitOk) allHealthy = false;

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Import routes
import authRoutes from './routes/auth.routes';
import botRoutes from './routes/bot.routes';
import autoResponseRoutes from './routes/auto-response.routes';
import messageRoutes from './routes/message.routes';
import mediaRoutes from './routes/media.routes';
import billingRoutes from './routes/billing.routes';
import dashboardRoutes from './routes/dashboard.routes';
import adminRoutes from './routes/admin.routes';
import adminStatsRoutes from './routes/admin-stats.routes';
import quotaRoutes from './routes/quota.routes';
import subscriptionRoutes from './routes/subscription.routes';
import testRoutes from './routes/test.routes';

// API routes
app.get(`/api/${config.server.apiVersion}`, (_req, res) => {
  res.json({
    message: 'WhatsApp API Monetization Platform',
    version: config.server.apiVersion,
  });
});

// Mount routes
app.use(`/api/${config.server.apiVersion}/auth`, authRoutes);
app.use(`/api/${config.server.apiVersion}/bots`, botRoutes);
app.use(`/api/${config.server.apiVersion}/bots`, autoResponseRoutes);
app.use(`/api/${config.server.apiVersion}/messages`, messageRoutes);
app.use(`/api/${config.server.apiVersion}/media`, mediaRoutes);
app.use(`/api/${config.server.apiVersion}/billing`, billingRoutes);
app.use(`/api/${config.server.apiVersion}/dashboard`, dashboardRoutes);
app.use(`/api/${config.server.apiVersion}/quota`, quotaRoutes);
app.use(`/api/${config.server.apiVersion}/subscriptions`, subscriptionRoutes);
app.use(`/api/${config.server.apiVersion}/admin`, adminRoutes);
app.use(`/api/${config.server.apiVersion}/admin`, adminStatsRoutes);

// Test routes (development only)
if (config.server.env !== 'production') {
  app.use(`/api/${config.server.apiVersion}/test`, testRoutes);
}

// Error handling middleware
interface HttpError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

app.use((err: HttpError, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Error:', err);
  const statusCode = err.statusCode ?? 500;
  res.status(statusCode).json({
    error: {
      code: err.code ?? 'INTERNAL_ERROR',
      message: err.message ?? 'Internal server error',
      details: err.details,
    },
    requestId: (req.headers['x-request-id'] as string) ?? 'unknown',
    timestamp: new Date(),
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

const PORT = config.server.port;

// Initialize services and start server
initializeServices()
  .then(async () => {
    const httpServer = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${config.server.env} mode`);
    });

    const { socketService } = await import('./services/socket.service');
    await socketService.initialize(httpServer);
  })
  .catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await shutdownServices();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await shutdownServices();
  process.exit(0);
});

export default app;
