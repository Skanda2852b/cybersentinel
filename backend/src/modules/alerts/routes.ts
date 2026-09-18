import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@utils/prisma';
import { authenticate, AuthenticatedRequest, requireRole } from '@middleware/auth';
import { ValidationError, NotFoundError } from '@middleware/errorHandler';

const router = Router();

const alertQuerySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(50),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE']).optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).optional(),
  ruleId: z.string().uuid().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

router.get('/', authenticate, async (req, res) => {
  const query = alertQuerySchema.parse(req.query);
  const { page, limit, status, severity, ruleId, startTime, endTime } = query;

  const where: any = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (ruleId) where.ruleId = ruleId;
  if (startTime || endTime) {
    where.createdAt = {};
    if (startTime) where.createdAt.gte = new Date(startTime);
    if (endTime) where.createdAt.lte = new Date(endTime);
  }

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { rule: true, events: { include: { event: true } }, mlPredictions: true },
    }),
    prisma.alert.count({ where }),
  ]);

  res.json({
    data: alerts,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
});

router.get('/:id', authenticate, async (req, res) => {
  const alert = await prisma.alert.findUnique({
    where: { id: req.params.id },
    include: { rule: true, events: { include: { event: true } }, mlPredictions: true, incidents: { include: { incident: true } } },
  });
  if (!alert) throw new NotFoundError('Alert');
  res.json(alert);
});

const updateStatusSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE']),
});

router.patch('/:id/status', authenticate, requireRole('ADMIN', 'ANALYST'), async (req, res) => {
  const { status } = updateStatusSchema.parse(req.body);

  const alert = await prisma.alert.update({
    where: { id: req.params.id },
    data: {
      status,
      acknowledgedAt: status === 'ACKNOWLEDGED' ? new Date() : undefined,
      resolvedAt: status === 'RESOLVED' || status === 'FALSE_POSITIVE' ? new Date() : undefined,
    },
  });

  res.json(alert);
});

export default router;