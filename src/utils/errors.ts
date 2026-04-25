export enum ErrorCode {
  // Authentication errors (401)
  INVALID_API_KEY = 'INVALID_API_KEY',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Authorization errors (403)
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Payment errors (402)
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  PAYMENT_FAILED = 'PAYMENT_FAILED',

  // Validation errors (400)
  INVALID_PHONE_NUMBER = 'INVALID_PHONE_NUMBER',
  INVALID_MESSAGE_TYPE = 'INVALID_MESSAGE_TYPE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Resource errors (404)
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
  BOT_NOT_FOUND = 'BOT_NOT_FOUND',
  MEDIA_NOT_FOUND = 'MEDIA_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Quota errors (403)
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  BOT_LIMIT_EXCEEDED = 'BOT_LIMIT_EXCEEDED',

  // Server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  WHATSAPP_API_ERROR = 'WHATSAPP_API_ERROR',
  BAILEYS_CONNECTION_ERROR = 'BAILEYS_CONNECTION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(code: ErrorCode, message: string) {
    super(code, message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string) {
    super(ErrorCode.INSUFFICIENT_PERMISSIONS, message, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(code: ErrorCode, message: string) {
    super(code, message, 404);
    this.name = 'NotFoundError';
  }
}

export class PaymentError extends AppError {
  constructor(code: ErrorCode, message: string) {
    super(code, message, 402);
    this.name = 'PaymentError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429);
    this.name = 'RateLimitError';
  }
}
