import { Router } from 'express';
import { prisma } from '@utils/prisma';
import { authenticate, requireRole, type AuthenticatedRequest } from '@middleware/auth';
import { strictRateLimiter } from '@middleware/rateLimiter';
import { runDemoAttack } from '@services/demoAttack';

const router = Router();

/**
 * Wipe all telemetry and derived records so the dashboard returns to zero.
 * Keeps users, detection rules, IOC definitions and event sources intact.
 * Audit logs are intentionally preserved.
 */
router.post('/reset', authenticate, requireRole('ADMIN'), strictRateLimiter, async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.sub;

  const [
    incidentNotes,
    incidentAlerts,
    eventAlerts,
    iocMatches,
    mlPredictions,
    alerts,
    incidents,
    events,
  ] = await prisma.$transaction([
    prisma.incidentNote.deleteMany(),
    prisma.incidentAlert.deleteMany(),
    prisma.eventAlert.deleteMany(),
    prisma.iOCMatch.deleteMany(),
    prisma.mLPrediction.deleteMany(),
    prisma.alert.deleteMany(),
    prisma.incident.deleteMany(),
    prisma.event.deleteMany(),
  ]);

  await prisma.auditLog.create({
    data: {
      action: 'DEMO_DATA_RESET',
      targetEntity: 'System',
      userId,
      ipAddress: req.ip,
      metadata: {
        incidents: incidents.count,
        alerts: alerts.count,
        events: events.count,
      } as any,
    },
  });

  res.json({
    deleted: {
      incidents: incidents.count,
      alerts: alerts.count,
      events: events.count,
      incidentNotes: incidentNotes.count,
      incidentAlerts: incidentAlerts.count,
      eventAlerts: eventAlerts.count,
      iocMatches: iocMatches.count,
      mlPredictions: mlPredictions.count,
    },
  });
});

/**
 * Reset demo attack data only - clears events from Demo Attack source,
 * related alerts, incidents, and ML predictions. Keeps other data intact.
 */
router.post('/demo/reset', authenticate, requireRole('ADMIN'), strictRateLimiter, async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.sub;

  // Find the demo attack event source
  const demoSource = await prisma.eventSource.findFirst({ where: { name: 'Demo Attack' } });
  if (!demoSource) {
    return res.json({ deleted: { events: 0, alerts: 0, incidents: 0, iocMatches: 0, mlPredictions: 0 } });
  }

  // Find events from the demo source
  const demoEvents = await prisma.event.findMany({ where: { sourceId: demoSource.id }, select: { id: true } });
  const demoEventIds = demoEvents.map(e => e.id);

  if (demoEventIds.length === 0) {
    return res.json({ deleted: { events: 0, alerts: 0, incidents: 0, iocMatches: 0, mlPredictions: 0 } });
  }

  const [
    incidentNotes,
    incidentAlerts,
    eventAlerts,
    iocMatches,
    mlPredictions,
    alerts,
    incidents,
    events,
  ] = await prisma.$transaction([
    prisma.incidentNote.deleteMany({ where: { incident: { alerts: { some: { eventId: { in: demoEventIds } } } } } }),
    prisma.incidentAlert.deleteMany({ where: { alert: { eventId: { in: demoEventIds } } } }),
    prisma.eventAlert.deleteMany({ where: { eventId: { in: demoEventIds } } }),
    prisma.iOCMatch.deleteMany({ where: { eventId: { in: demoEventIds } } }),
    prisma.mLPrediction.deleteMany({ where: { eventId: { in: demoEventIds } } }),
    prisma.alert.deleteMany({ where: { events: { some: { eventId: { in: demoEventIds } } } } }),
    prisma.incident.deleteMany({ where: { alerts: { some: { alert: { eventId: { in: demoEventIds } } } } } }),
    prisma.event.deleteMany({ where: { id: { in: demoEventIds } } }),
  ]);

  await prisma.auditLog.create({
    data: {
      action: 'DEMO_ATTACK_RESET',
      targetEntity: 'System',
      userId,
      ipAddress: req.ip,
      metadata: {
        events: events.count,
        alerts: alerts.count,
        incidents: incidents.count,
        iocMatches: iocMatches.count,
        mlPredictions: mlPredictions.count,
      } as any,
    },
  });

  res.json({
    deleted: {
      events: events.count,
      alerts: alerts.count,
      incidents: incidents.count,
      incidentNotes: incidentNotes.count,
      incidentAlerts: incidentAlerts.count,
      eventAlerts: eventAlerts.count,
      iocMatches: iocMatches.count,
      mlPredictions: mlPredictions.count,
    },
  });
});

/**
 * Run a canned multi-scenario attack through the real ingestion pipeline
 * (persist -> IOC match -> rule detection -> alert + ML -> auto-grouped
 * incidents) so the UI numbers move live.
 */
router.post('/demo/attack', authenticate, requireRole('ADMIN'), strictRateLimiter, async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.sub;
  const result = await runDemoAttack({ ipAddress: req.ip, userId });
  res.status(201).json(result);
});

export default router;
