import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

/**
 * Sanitize string input to prevent XSS attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
}

/**
 * Validate and sanitize email
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (international format)
 */
export function validatePhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Check if it's a valid length (10-15 digits)
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Middleware to validate request body size
 */
export const validateBodySize = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > maxSize) {
      throw new ValidationError(`Request body too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
    }
    
    next();
  };
};

/**
 * Middleware to sanitize all string inputs in request body
 */
export const sanitizeInputs = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

/**
 * Validate common request parameters
 */
export const validateCommonParams = (req: Request, _res: Response, next: NextFunction) => {
  // Validate UUID parameters
  const uuidParams = ['id', 'userId', 'botId', 'messageId'];
  
  for (const param of uuidParams) {
    if (req.params[param] && !validateUUID(req.params[param])) {
      throw new ValidationError(`Invalid ${param} format`);
    }
    
    if (req.body[param] && !validateUUID(req.body[param])) {
      throw new ValidationError(`Invalid ${param} format`);
    }
  }
  
  next();
};
