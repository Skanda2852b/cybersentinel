import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '@utils/logger';
import { isProduction } from '@config';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, message, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(429, message, 'RATE_LIMIT_EXCEEDED');
  }
}

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string | undefined;

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
      requestId,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      details: err.details,
      requestId,
    });
  }

  logger.error({ err, requestId, path: req.path, method: req.method }, 'Unhandled error');

  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: isProduction ? 'An unexpected error occurred' : err.message,
    requestId,
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    requestId: req.headers['x-request-id'],
  });
};