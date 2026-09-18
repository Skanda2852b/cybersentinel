import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const createRateLimiter = (windowMs?: number, max?: number) => {
  return rateLimit({
    windowMs: windowMs || config.RATE_LIMIT_WINDOW_MS,
    max: max || config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || 'unknown',
    handler: (_req, res) => {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      });
    },
  });
};

export const generalRateLimiter = createRateLimiter();

export const strictRateLimiter = createRateLimiter(60000, 10);

export const ingestionRateLimiter = createRateLimiter(60000, 1000);