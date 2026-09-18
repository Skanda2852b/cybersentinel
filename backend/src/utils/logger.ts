import pino from 'pino';
import { config } from '@config';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'cybersentinel-backend' },
});

export const createChildLogger = (context: Record<string, unknown>) => logger.child(context);