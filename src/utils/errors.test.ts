import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  PaymentError,
  RateLimitError,
  ErrorCode,
} from './errors';

describe('errors', () => {
  it('AppError should have correct properties', () => {
    const err = new AppError(ErrorCode.INTERNAL_ERROR, 'Test error', 500, { foo: 'bar' });
    expect(err.message).toBe('Test error');
    expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(err.statusCode).toBe(500);
    expect(err.details).toEqual({ foo: 'bar' });
    expect(err.name).toBe('AppError');
  });

  it('ValidationError should default to 400', () => {
    const err = new ValidationError('Invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('AuthenticationError should default to 401', () => {
    const err = new AuthenticationError(ErrorCode.INVALID_CREDENTIALS, 'Bad credentials');
    expect(err.statusCode).toBe(401);
  });

  it('AuthorizationError should default to 403', () => {
    const err = new AuthorizationError('Admin required');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe(ErrorCode.INSUFFICIENT_PERMISSIONS);
  });

  it('NotFoundError should default to 404', () => {
    const err = new NotFoundError(ErrorCode.BOT_NOT_FOUND, 'Bot not found');
    expect(err.statusCode).toBe(404);
  });

  it('PaymentError should default to 402', () => {
    const err = new PaymentError(ErrorCode.INSUFFICIENT_BALANCE, 'Low balance');
    expect(err.statusCode).toBe(402);
  });

  it('RateLimitError should default to 429', () => {
    const err = new RateLimitError('Too many requests');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
  });
});
