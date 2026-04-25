import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * Middleware to redirect HTTP to HTTPS in production
 */
export const httpsRedirectMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip redirect for Socket.IO (default path and custom /whatsapp/socket.io)
  const path = req.path;
  if (path.startsWith('/socket.io/') || path.includes('/socket.io/')) {
    return next();
  }

  // Only redirect in production if enabled
  if (
    config.server.env === 'production' &&
    config.security.enableHttpsRedirect &&
    req.headers['x-forwarded-proto'] !== 'https' &&
    !req.secure
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  
  next();
};
