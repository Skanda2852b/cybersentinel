import { Router } from 'express';
import authRoutes from './auth/routes';
import eventsRoutes from './events/routes';
import eventsSourcesRoutes from './events/sources';
import alertsRoutes from './alerts/routes';
import incidentsRoutes from './incidents/routes';
import iocsRoutes from './iocs/routes';
import analyticsRoutes from './analytics/routes';
import aiRoutes from './ai/routes';
import systemRoutes from './system/routes';
import detectionRulesRoutes from './detection-rules/routes';
import adminRoutes from './admin/routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/events', eventsRoutes);
router.use('/event-sources', eventsSourcesRoutes);
router.use('/alerts', alertsRoutes);
router.use('/incidents', incidentsRoutes);
router.use('/iocs', iocsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/ai', aiRoutes);
router.use('/admin', adminRoutes);
router.use('/detection-rules', detectionRulesRoutes);
router.use('/system', systemRoutes);
router.use('/audit-logs', systemRoutes);

export default router;