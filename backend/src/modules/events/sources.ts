import { Router } from 'express';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '@utils/prisma';
import { authenticate, requireRole } from '@middleware/auth';
import { ValidationError, NotFoundError } from '@middleware/errorHandler';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const sources = await prisma.eventSource.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { events: true } } },
  });
  res.json(sources);
});

router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['AGENT', 'SYSLOG', 'API', 'CLOUD', 'NETWORK']),
    description: z.string().optional(),
  });

  const data = schema.parse(req.body);

  const apiKey = `cs_${randomBytes(24).toString('hex')}`;
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

  const source = await prisma.eventSource.create({
    data: { ...data, apiKeyHash },
  });

  res.status(201).json({ ...source, apiKey });
});

router.get('/:id', authenticate, async (req, res) => {
  const source = await prisma.eventSource.findUnique({
    where: { id: req.params.id },
    include: { events: { take: 10, orderBy: { timestamp: 'desc' } } },
  });
  if (!source) throw new NotFoundError('Event Source');
  res.json(source);
});

router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  await prisma.eventSource.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;