import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@utils/prisma';
import { authenticate } from '@middleware/auth';
import { ValidationError, NotFoundError } from '@middleware/errorHandler';
import { hashApiKey, ingestEvents } from '@services/eventIngestion';

const router = Router();

const eventSchema = z.object({
  timestamp: z.string().datetime(),
  eventType: z.string().min(1).max(100),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).default('INFO'),
  sourceIp: z.string().ip().nullish(),
  destIp: z.string().ip().nullish(),
  username: z.string().max(255).nullish(),
  metadata: z.record(z.unknown()).default({}),
});

const batchEventSchema = z.array(eventSchema).min(1).max(1000);

router.post('/', async (req: Request, res: Response) => {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    throw new ValidationError('X-API-Key header required');
  }

  // Keys are stored as SHA-256 hashes (see event-sources creation) —
  // hash the presented key before comparing.
  const source = await prisma.eventSource.findFirst({
    where: { apiKeyHash: hashApiKey(apiKey), isActive: true },
  });

  if (!source) {
    throw new ValidationError('Invalid or inactive API key');
  }

  await prisma.eventSource.update({
    where: { id: source.id },
    data: { lastSeenAt: new Date() },
  });

  const isBatch = Array.isArray(req.body);
  const events = isBatch ? req.body : [req.body];

  const parsed = batchEventSchema.safeParse(events);
  if (!parsed.success) {
    throw new ValidationError('Invalid event data', parsed.error.errors);
  }

  const result = await ingestEvents({
    sourceId: source.id,
    events: parsed.data,
    ipAddress: req.ip,
  });

  res.status(201).json({
    ingested: result.ingested,
    duplicates: result.duplicates,
    alertsCreated: result.alertsCreated.length,
    events: result.events,
  });
});

router.get('/', authenticate, async (req, res) => {
  const {
    page = '1',
    limit = '50',
    startTime,
    endTime,
    eventType,
    severity,
    sourceIp,
    destIp,
    username,
    sourceId,
  } = req.query;

  const where: any = {};
  if (startTime || endTime) {
    where.timestamp = {};
    if (startTime) where.timestamp.gte = new Date(startTime as string);
    if (endTime) where.timestamp.lte = new Date(endTime as string);
  }
  if (eventType) where.eventType = eventType;
  if (severity) where.severity = severity;
  if (sourceIp) where.sourceIp = sourceIp;
  if (destIp) where.destIp = destIp;
  if (username) where.username = username;
  if (sourceId) where.sourceId = sourceId;

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: { source: true },
    }),
    prisma.event.count({ where }),
  ]);

  res.json({
    data: events,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

router.get('/:id', authenticate, async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      source: true,
      alerts: { include: { alert: true } },
      mlPredictions: true,
      iocMatches: { include: { ioc: true } },
    },
  });

  if (!event) throw new NotFoundError('Event');
  res.json(event);
});

export default router;