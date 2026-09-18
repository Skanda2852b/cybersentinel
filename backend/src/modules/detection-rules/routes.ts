import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@utils/prisma';
import { authenticate, requireRole } from '@middleware/auth';
import { NotFoundError } from '@middleware/errorHandler';

// Must stay in sync with DetectionEngine.compareValues / aggregations.
const OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'not_in',
] as const;

const AGGREGATIONS = ['count', 'uniqueCount', 'sum', 'avg'] as const;

const ruleConditionSchema = z.object({
  field: z.string().min(1).max(100).optional(),
  operator: z.enum(OPERATORS),
  value: z.unknown(),
  aggregation: z.enum(AGGREGATIONS).optional(),
  aggregationField: z.string().max(100).optional(),
  window: z.string().regex(/^\d+[mhd]$/, 'Window must look like 5m, 1h or 1d').optional(),
  groupBy: z.union([z.string().max(100), z.array(z.string().max(100)).min(1).max(3)]).optional(),
});

const ruleLogicSchema = z.object({
  condition: z.enum(['AND', 'OR']),
  rules: z.array(ruleConditionSchema).min(1).max(20),
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().default(true),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
  logic: ruleLogicSchema,
});

const updateRuleSchema = createRuleSchema.partial();

const router = Router();

router.get('/', authenticate, async (_req, res) => {
  const rules = await prisma.detectionRule.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { alerts: true } } },
  });
  res.json(rules);
});

router.post('/', authenticate, requireRole('ADMIN', 'ANALYST'), async (req, res) => {
  const data = createRuleSchema.parse(req.body);
  const rule = await prisma.detectionRule.create({
    data: {
      name: data.name,
      description: data.description,
      enabled: data.enabled,
      severity: data.severity,
      logic: data.logic as any,
    },
  });
  res.status(201).json(rule);
});

router.get('/:id', authenticate, async (req, res) => {
  const rule = await prisma.detectionRule.findUnique({
    where: { id: req.params.id },
    include: { alerts: { take: 10, orderBy: { createdAt: 'desc' } } },
  });
  if (!rule) throw new NotFoundError('Detection Rule');
  res.json(rule);
});

router.patch('/:id', authenticate, requireRole('ADMIN', 'ANALYST'), async (req, res) => {
  const data = updateRuleSchema.parse(req.body);
  const rule = await prisma.detectionRule.update({
    where: { id: req.params.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      ...(data.severity !== undefined ? { severity: data.severity } : {}),
      ...(data.logic !== undefined ? { logic: data.logic as any } : {}),
    },
  });
  res.json(rule);
});

router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  await prisma.detectionRule.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
