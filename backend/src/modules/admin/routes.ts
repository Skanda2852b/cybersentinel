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
