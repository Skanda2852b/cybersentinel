import { createHash } from 'crypto';
import type { Event, Severity } from '@prisma/client';
import { prisma } from '@utils/prisma';
import { logger } from '@utils/logger';
import { detectionEngine } from './detectionEngine';
import { alertService } from './alertService';
import { riskEngine } from './riskEngine';
import { iocMatcher } from './iocMatcher';

export interface IngestEventInput {
  timestamp: string;
  eventType: string;
  severity: Severity;
  sourceIp?: string | null;
  destIp?: string | null;
  username?: string | null;
  metadata?: Record<string, unknown>;
}

export interface IngestResult {
  ingested: number;
  duplicates: number;
  alertsCreated: string[];
  iocMatches: number;
  events: Array<{ id: string; timestamp: Date }>;
}

export function generateDedupHash(event: Pick<IngestEventInput, 'timestamp' | 'eventType' | 'sourceIp' | 'destIp' | 'username'>): string {
  const normalized = `${event.timestamp}|${event.eventType}|${event.sourceIp || ''}|${event.destIp || ''}|${event.username || ''}`;
  return createHash('sha256').update(normalized).digest('hex');
}

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * The single ingestion pipeline used by every entry point (HTTP API key
 * ingestion, demo attack generator, future collectors).
 *
 * Per event: persist -> IOC match -> rule detection -> alert (+ML) creation.
 * Duplicates (same dedup hash) are skipped, never error.
 */
export async function ingestEvents(options: {
  sourceId: string;
  events: IngestEventInput[];
  ipAddress?: string;
  userId?: string | null;
}): Promise<IngestResult> {
  const { sourceId, events, ipAddress, userId } = options;

  const createdEvents: Event[] = [];
  const alertsCreated: string[] = [];
  let iocMatches = 0;

  for (const event of events) {
    const dedupHash = generateDedupHash(event);

    try {
      const created = await prisma.event.create({
        data: {
          sourceId,
          timestamp: new Date(event.timestamp),
          eventType: event.eventType,
          severity: event.severity,
          sourceIp: event.sourceIp ?? null,
          destIp: event.destIp ?? null,
          username: event.username ?? null,
          dedupHash,
          metadata: (event.metadata ?? {}) as any,
        },
      });
      createdEvents.push(created);

      const iocMatcherService = iocMatcher(prisma);
      const matches = await iocMatcherService.matchAndStore(created);
      iocMatches += matches.length;

      const engine = detectionEngine(prisma);
      const triggeredRules = await engine.evaluateEvent(created);

      if (triggeredRules.length > 0) {
        const alertSvc = alertService(prisma, riskEngine);
        for (const triggered of triggeredRules) {
          const alert = await alertSvc.createFromRule(created, triggered.rule as any, triggered.matchedConditions);
          alertsCreated.push(alert.id);
        }
      }

      if (matches.length > 0) {
        logger.info({ eventId: created.id, iocMatches: matches.length }, 'IOC matches found for event');
      }
    } catch (err: any) {
      if (err.code === 'P2002') {
        logger.debug({ dedupHash }, 'Duplicate event skipped');
      } else {
        throw err;
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      action: 'EVENT_INGESTION',
      targetEntity: 'Event',
      targetId: createdEvents[0]?.id ?? 'batch',
      ipAddress,
      userId: userId ?? null,
      metadata: { count: createdEvents.length, sourceId, alertsCreated: alertsCreated.length } as any,
    },
  });

  return {
    ingested: createdEvents.length,
    duplicates: events.length - createdEvents.length,
    alertsCreated,
    iocMatches,
    events: createdEvents.map((e) => ({ id: e.id, timestamp: e.timestamp })),
  };
}

export { hashApiKey };
