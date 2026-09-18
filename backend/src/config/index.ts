import dotenv from 'dotenv';
dotenv.config();

import { z } from 'zod';

// z.coerce.boolean() uses Boolean(value), so the string "false" becomes true.
// Env flags must be parsed explicitly.
const envBoolean = (defaultValue: boolean) =>
  z
    .preprocess((v) => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') return ['true', '1', 'yes'].includes(v.toLowerCase());
      if (v === undefined || v === null) return defaultValue;
      return Boolean(v);
    }, z.boolean())
    .default(defaultValue);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().url(),
  INGESTION_API_KEY: z.string().min(16),
  ML_SERVICE_URL: z.string().url(),
  ML_SERVICE_TIMEOUT_MS: z.coerce.number().default(5000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: envBoolean(false),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  COOKIE_SECURE: envBoolean(true),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  AI_PROVIDER: z.enum(['none', 'openai', 'local']).default('none'),
  AI_BASE_URL: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

export const config = envSchema.parse(process.env);

export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';