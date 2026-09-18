import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@utils/prisma';
import { authenticate, requireRole } from '@middleware/auth';
import { ValidationError, NotFoundError } from '@middleware/errorHandler';

const router = Router();

const iocQuerySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(50),
  type: z.enum(['IP', 'DOMAIN', 'URL', 'HASH_MD5', 'HASH_SHA1', 'HASH_SHA256', 'EMAIL', 'CIDR', 'REGISTRY_KEY', 'MUTEX']).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

router.get('/', authenticate, async (req, res) => {
  const query = iocQuerySchema.parse(req.query);
  const { page, limit, type, isActive, search } = query;

  const where: any = {};
  if (type) where.type = type;
  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where.OR = [
      { value: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { source: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [iocs, total] = await Promise.all([
    prisma.iOC.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { matches: { include: { event: true } } },
    }),
    prisma.iOC.count({ where }),
  ]);

  res.json({ data: iocs, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
});

router.post('/', authenticate, requireRole('ADMIN', 'ANALYST'), async (req, res) => {
  const schema = z.object({
    type: z.enum(['IP', 'DOMAIN', 'URL', 'HASH_MD5', 'HASH_SHA1', 'HASH_SHA256', 'EMAIL', 'CIDR', 'REGISTRY_KEY', 'MUTEX']),
    value: z.string().min(1),
    confidence: z.number().min(0).max(1).default(1),
    source: z.string().optional(),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
  });

  const data = schema.parse(req.body);

  const ioc = await prisma.iOC.create({ data });
  res.status(201).json(ioc);
});

router.get('/:id', authenticate, async (req, res) => {
  const ioc = await prisma.iOC.findUnique({
    where: { id: req.params.id },
    include: { matches: { include: { event: true } } },
  });
  if (!ioc) throw new NotFoundError('IOC');
  res.json(ioc);
});

router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  await prisma.iOC.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;