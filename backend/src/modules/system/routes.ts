import { Router } from 'express';
import { prisma } from '@utils/prisma';
import { authenticate, requireRole } from '@middleware/auth';
import { mlClient } from '@services/mlClient';
import { getAIProvider } from '@services/aiService';
import { config } from '@config';

const router = Router();

// Live platform status for the Settingsreseed integrations/system tabs.
// Safe for every authenticated role: statuses only, no secrets or config values.
router.get('/status', authenticate, async (_req, res) => {
  let database: 'connected' | 'disconnected' = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'connected';
  } catch {
    database = 'disconnected';
  }

  const [mlHealth, aiHealthy] = await Promise.all([
    mlClient.healthCheck(),
    getAIProvider().healthCheck().catch(() => false),
  ]);

  res.json({
    version: '0.1.0',
    environment: config.NODE_ENV,
    backend: 'ok',
    database,
    mlService: {
      status: mlHealth.status,
      version: mlHealth.version,
      modelLoaded: mlHealth.model_loaded,
      endpoint: config.ML_SERVICE_URL,
    },
    ai: {
      provider: config.AI_PROVIDER,
      healthy: aiHealthy,
      model: config.AI_MODEL,
    },
  });
});

router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { page = '1', limit = '50', userId, action, startTime, endTime } = req.query;

  const where: any = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (startTime || endTime) {
    where.createdAt = {};
    if (startTime) where.createdAt.gte = new Date(startTime as string);
    if (endTime) where.createdAt.lte = new Date(endTime as string);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ data: logs, meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

export default router;