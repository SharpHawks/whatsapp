import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration } from '../config/metrics';

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function normalizeRoute(path: string): string {
  return path.replace(UUID_REGEX, ':id').replace(/\/+/g, '/') || '/';
}

/**
 * Middleware to record HTTP request duration for Prometheus metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = normalizeRoute(req.route?.path ?? req.path);
    const statusCode = String(res.statusCode);

    httpRequestDuration.observe(
      {
        method: req.method,
        route: route || '/',
        status_code: statusCode,
      },
      duration
    );
  });

  next();
}
