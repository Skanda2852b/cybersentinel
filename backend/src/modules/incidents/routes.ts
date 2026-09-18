import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@utils/prisma';
import { authenticate, requireRole } from '@middleware/auth';
import { ValidationError, NotFoundError } from '@middleware/errorHandler';
import { incidentService } from '@services/incidentService';

const router = Router();

const incidentQuerySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(50),
  status: z.enum(['OPEN', 'INVESTIGATING', 'CONTAINED', 'ERADICATED', 'RECOVERED', 'CLOSED']).optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).optional(),
  assignedUserId: z.string().uuid().optional(),
});

router.get('/', authenticate, async (req, res) => {
  const query = incidentQuerySchema.parse(req.query);
  const { page, limit, status, severity, assignedUserId } = query;

  const where: any = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (assignedUserId) where.assignedUserId = assignedUserId;

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: { lastSeen: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { assignedUser: true, alerts: { include: { alert: true } }, notes: { include: { user: true } } },
    }),
    prisma.incident.count({ where }),
  ]);

  res.json({ data: incidents, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});

router.post('/', authenticate, requireRole('ADMIN', 'ANALYST'), async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
    alertIds: z.array(z.string().uuid()).min(1),
    assignedUserId: z.string().uuid().optional(),
  });

  const data = schema.parse(req.body);

  const incident = await prisma.incident.create({
    data: {
      title: data.title,
      description: data.description,
      severity: data.severity,
      assignedUserId: data.assignedUserId,
      alerts: { create: data.alertIds.map(alertId => ({ alertId })) },
    },
    include: { alerts: { include: { alert: true } }, assignedUser: true },
  });

  await prisma.alert.updateMany({
    where: { id: { in: data.alertIds } },
    data: { status: 'INVESTIGATING' },
  });

  res.status(201).json(incident);
});

// NB: z.coerce.boolean() turns the string "false" into true; parse explicitly.
const booleanish = z.preprocess(
  (v) => (typeof v === 'string' ? ['true', '1', 'yes'].includes(v.toLowerCase()) : v),
  z.boolean()
);

const autoGroupSchema = z.object({
  timeWindowHours: z.coerce.number().positive().max(72).default(4),
  groupBySourceIp: booleanish.default(true),
  groupByRule: booleanish.default(false),
  minAlertsPerIncident: z.coerce.number().int().positive().max(100).default(2),
});

router.post('/auto-group', authenticate, requireRole('ADMIN', 'ANALYST'), async (req, res) => {
  const options = autoGroupSchema.parse(req.body ?? {});
  const incidents = await incidentService(prisma).autoGroupAlerts(options);
  res.status(201).json({ created: incidents.length, incidents });
});

router.get('/:id', authenticate, async (req, res) => {
  const incident = await prisma.incident.findUnique({
    where: { id: req.params.id },
    include: { assignedUser: true, alerts: { include: { alert: true } }, notes: { include: { user: true } } },
  });
  if (!incident) throw new NotFoundError('Incident');
  res.json(incident);
});

router.patch('/:id', authenticate, requireRole('ADMIN', 'ANALYST'), async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).optional(),
    status: z.enum(['OPEN', 'INVESTIGATING', 'CONTAINED', 'ERADICATED', 'RECOVERED', 'CLOSED']).optional(),
    assignedUserId: z.string().uuid().nullable().optional(),
    riskScore: z.number().min(0).max(100).optional(),
  });

  const data = schema.parse(req.body);

  const incident = await prisma.incident.update({
    where: { id: req.params.id },
    data: {
      ...data,
      lastSeen: new Date(),
      resolvedAt: data.status === 'CLOSED' || data.status === 'RECOVERED' ? new Date() : undefined,
    },
    include: { assignedUser: true, alerts: { include: { alert: true } } },
  });

  res.json(incident);
});

router.post('/:id/notes', authenticate, async (req, res) => {
  const schema = z.object({ content: z.string().min(1) });
  const { content } = schema.parse(req.body);

  const note = await prisma.incidentNote.create({
    data: { incidentId: req.params.id, userId: req.user!.sub, content },
    include: { user: true },
  });

  res.status(201).json(note);
});

export default router;