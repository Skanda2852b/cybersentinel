import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@utils/prisma';
import { authenticate, requireRole } from '@middleware/auth';
import { ValidationError, NotFoundError } from '@middleware/errorHandler';
import { getAIProvider } from '@services/aiService';
import { config } from '@config';

const router = Router();

router.post('/investigate', authenticate, requireRole('ADMIN', 'ANALYST'), async (req, res) => {
  const schema = z.object({
    incidentId: z.string().uuid(),
    context: z.string().optional(),
  });

  const { incidentId, context } = schema.parse(req.body);

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      alerts: { 
        include: { 
          alert: { 
            include: { 
              rule: true, 
              events: { include: { event: true } } 
            } 
          } 
        } 
      },
      notes: { include: { user: true } },
    },
  });

  if (!incident) throw new NotFoundError('Incident');

  const iocMatches = await prisma.iOCMatch.findMany({
    where: {
      event: {
        alerts: { some: { alert: { incidents: { some: { incidentId } } } } },
      },
    },
    include: { ioc: true, event: true },
  });

  const timeline = incident.alerts
    .flatMap(ia => ia.alert.events.map(e => ({
      time: e.event.timestamp,
      event: ia.alert.title,
      severity: ia.alert.severity,
      sourceIp: e.event.sourceIp,
    })))
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const aiContext = {
    incident: {
      id: incident.id,
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      status: incident.status,
      riskScore: incident.riskScore,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
    },
    alerts: incident.alerts.map(ia => ({
      id: ia.alert.id,
      title: ia.alert.title,
      severity: ia.alert.severity,
      riskScore: ia.alert.riskScore,
      status: ia.alert.status,
      rule: ia.alert.rule ? { name: ia.alert.rule.name, description: ia.alert.rule.description } : undefined,
      events: ia.alert.events.map(e => ({ event: e.event })),
      createdAt: ia.alert.createdAt,
    })),
    iocMatches: iocMatches.map(im => ({
      ioc: {
        id: im.ioc.id,
        type: im.ioc.type,
        value: im.ioc.value,
        confidence: im.ioc.confidence,
        source: im.ioc.source,
        tags: im.ioc.tags,
        description: im.ioc.description,
      },
      iocId: im.ioc.id,
      iocType: im.ioc.type,
      iocValue: im.ioc.value,
      iocConfidence: im.ioc.confidence,
      iocSource: im.ioc.source,
      iocTags: im.ioc.tags,
      iocDescription: im.ioc.description,
      matchedField: 'event',
      matchedValue: '',
      matchedAt: im.matchedAt,
    })),
    timeline,
  };

  const provider = getAIProvider();
  const analysis = await provider.investigate(aiContext);

  res.json({
    incidentId,
    summary: analysis.summary,
    timeline: analysis.timeline,
    mitreTechniques: analysis.mitreTechniques,
    recommendations: analysis.recommendations,
    riskAssessment: analysis.riskAssessment,
    provider: config.AI_PROVIDER,
  });
});

// Provider name + reachability only — safe for every authenticated role.
router.get('/health', authenticate, async (req, res) => {
  const provider = getAIProvider();
  const healthy = await provider.healthCheck();
  res.json({ provider: config.AI_PROVIDER, healthy });
});

export default router;