import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@utils/prisma';
import { authenticate } from '@middleware/auth';
import { NotFoundError } from '@middleware/errorHandler';

const router = Router();

// Percent change of this 24h window vs the prior 24h window.
// Returns '+12%' / '-4%' / '0%', or 'new' when there was no prior activity.
function pctTrend(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? 'new' : '0%';
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

// Signed absolute net change, e.g. '+3' / '-1' / '0'.
function netTrend(opened: number, closed: number): string {
  const net = opened - closed;
  return `${net > 0 ? '+' : ''}${net}`;
}

router.get('/dashboard', authenticate, async (req, res) => {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const [
    totalEvents,
    totalAlerts,
    openAlerts,
    totalIncidents,
    openIncidents,
    criticalAlerts,
    eventsLast24h,
    alertsLast24h,
    eventsPrev24h,
    alertsPrev24h,
    incidentsLast24h,
    incidentsPrev24h,
    criticalLast24h,
    criticalPrev24h,
    alertsClosed24h,
    incidentsClosed24h,
    topSourceIps,
    topEventTypes,
    severityDistribution,
    eventsTimeSeries,
    alertsTimeSeries,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.alert.count(),
    prisma.alert.count({ where: { status: 'OPEN' } }),
    prisma.incident.count(),
    prisma.incident.count({ where: { status: { in: ['OPEN', 'INVESTIGATING'] } } }),
    prisma.alert.count({ where: { severity: 'CRITICAL' } }),
    prisma.event.count({ where: { timestamp: { gte: dayAgo } } }),
    prisma.alert.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.event.count({ where: { timestamp: { gte: twoDaysAgo, lt: dayAgo } } }),
    prisma.alert.count({ where: { createdAt: { gte: twoDaysAgo, lt: dayAgo } } }),
    prisma.incident.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.incident.count({ where: { createdAt: { gte: twoDaysAgo, lt: dayAgo } } }),
    prisma.alert.count({ where: { severity: 'CRITICAL', createdAt: { gte: dayAgo } } }),
    prisma.alert.count({ where: { severity: 'CRITICAL', createdAt: { gte: twoDaysAgo, lt: dayAgo } } }),
    prisma.alert.count({ where: { status: { in: ['RESOLVED', 'FALSE_POSITIVE'] }, resolvedAt: { gte: dayAgo } } }),
    prisma.incident.count({ where: { status: { in: ['CONTAINED', 'ERADICATED', 'RECOVERED', 'CLOSED'] }, updatedAt: { gte: dayAgo } } }),
    prisma.event.groupBy({
      by: ['sourceIp'],
      where: { sourceIp: { not: null }, timestamp: { gte: dayAgo } },
      _count: { sourceIp: true },
      orderBy: { _count: { sourceIp: 'desc' } },
      take: 10,
    }),
    prisma.event.groupBy({
      by: ['eventType'],
      where: { timestamp: { gte: dayAgo } },
      _count: { eventType: true },
      orderBy: { _count: { eventType: 'desc' } },
      take: 10,
    }),
    prisma.event.groupBy({
      by: ['severity'],
      where: { timestamp: { gte: dayAgo } },
      _count: { severity: true },
    }),
    prisma.$queryRaw`
      SELECT 
        date_trunc('hour', timestamp) as timestamp,
        COUNT(*) as value
      FROM events
      WHERE timestamp >= ${dayAgo}
      GROUP BY date_trunc('hour', timestamp)
      ORDER BY timestamp
    `,
    prisma.$queryRaw`
      SELECT
        date_trunc('hour', "createdAt") as timestamp,
        COUNT(*) as value
      FROM alerts
      WHERE "createdAt" >= ${dayAgo}
      GROUP BY date_trunc('hour', "createdAt")
      ORDER BY timestamp
    `,
  ]);

  // Raw SQL COUNT(*) comes back as BigInt, which JSON cannot serialize.
  const toTimeSeries = (rows: Array<{ timestamp: Date; value: bigint }>) =>
    rows.map((row) => ({ timestamp: row.timestamp, value: Number(row.value) }));

  res.json({
    totalEvents,
    totalAlerts,
    openAlerts,
    totalIncidents,
    openIncidents,
    criticalAlerts,
    eventsLast24h,
    alertsLast24h,
    trends: {
      totalEvents: pctTrend(eventsLast24h, eventsPrev24h),
      totalAlerts: pctTrend(alertsLast24h, alertsPrev24h),
      openAlerts: netTrend(alertsLast24h, alertsClosed24h),
      totalIncidents: pctTrend(incidentsLast24h, incidentsPrev24h),
      openIncidents: netTrend(incidentsLast24h, incidentsClosed24h),
      criticalAlerts: pctTrend(criticalLast24h, criticalPrev24h),
    },
    topSourceIps: topSourceIps.map(r => ({ ip: r.sourceIp, count: Number(r._count.sourceIp) })),
    topEventTypes: topEventTypes.map(r => ({ type: r.eventType, count: Number(r._count.eventType) })),
    severityDistribution: severityDistribution.map(r => ({ severity: r.severity, count: Number(r._count.severity) })),
    eventsTimeSeries: toTimeSeries(eventsTimeSeries as Array<{ timestamp: Date; value: bigint }>),
    alertsTimeSeries: toTimeSeries(alertsTimeSeries as Array<{ timestamp: Date; value: bigint }>),
  });
});

const timeseriesQuerySchema = z.object({
  metric: z.enum(['events', 'alerts']).default('events'),
  interval: z.enum(['1m', '5m', '15m', '1h', '6h', '1d']).default('1h'),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

// Identifiers cannot be bound as $n parameters in Postgres, so table/column/
// interval names come strictly from these allowlists (never from raw input).
const TIMESERIES_SOURCES = {
  events: { table: 'events', column: 'timestamp' },
  alerts: { table: 'alerts', column: 'createdAt' },
} as const;

const TIMESERIES_INTERVALS: Record<string, string> = {
  '1m': 'minute',
  '5m': '5 minutes',
  '15m': '15 minutes',
  '1h': 'hour',
  '6h': '6 hours',
  '1d': 'day',
};

router.get('/timeseries', authenticate, async (req, res) => {
  const { metric, interval, startTime, endTime } = timeseriesQuerySchema.parse(req.query);

  const { table, column } = TIMESERIES_SOURCES[metric];
  const pgInterval = TIMESERIES_INTERVALS[interval];

  const filters: Prisma.Sql[] = [];
  if (startTime) filters.push(Prisma.sql`${Prisma.raw(`"${column}"`)} >= ${new Date(startTime)}`);
  if (endTime) filters.push(Prisma.sql`${Prisma.raw(`"${column}"`)} <= ${new Date(endTime)}`);
  const whereClause = filters.length > 0 ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}` : Prisma.empty;

  // pgInterval/table/column are inlined (not bound) because Postgres does not
  // accept $n placeholders for identifiers or date_trunc field names.
  // All three come strictly from the allowlists above, never from raw input.
  const data = await prisma.$queryRaw<Array<{ timestamp: Date; value: bigint }>>(
    Prisma.sql`SELECT date_trunc(${Prisma.raw(`'${pgInterval}'`)}, ${Prisma.raw(`"${column}"`)}) AS timestamp, COUNT(*) AS value FROM ${Prisma.raw(`"${table}"`)} ${whereClause} GROUP BY 1 ORDER BY 1`
  );

  res.json({
    data: data.map((row) => ({ timestamp: row.timestamp, value: Number(row.value) })),
    metric,
    interval,
  });
});

export default router;