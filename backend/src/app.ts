import 'express-async-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestIdMiddleware, requestLogger } from './middleware/requestLogger';
import { generalRateLimiter } from './middleware/rateLimiter';
import { authenticate, AuthenticatedRequest } from './middleware/auth';
import { prisma } from './utils/prisma';
import apiRoutes from './api/routes';

export const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: config.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(pinoHttp({ logger: logger as any, genReqId: (req) => req.headers['x-request-id'] as string }));
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(generalRateLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'cybersentinel-backend' });
});

app.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'not ready', database: 'disconnected' });
  }
});

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);