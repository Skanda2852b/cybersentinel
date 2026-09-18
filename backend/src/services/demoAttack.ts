import { randomBytes } from 'crypto';
import { prisma } from '@utils/prisma';
import { logger } from '@utils/logger';
import { ingestEvents, type IngestEventInput } from './eventIngestion';
import { incidentService } from './incidentService';

export interface DemoScenarioResult {
  name: string;
  ingested: number;
  alertsCreated: number;
}

export interface DemoAttackResult {
  ingested: number;
  duplicates: number;
  alertsCreated: number;
  iocMatches: number;
  incidentsCreated: number;
  scenarios: DemoScenarioResult[];
}

function ts(dt: Date): string {
  return dt.toISOString().replace('+00:00', 'Z');
}

function minutesAgo(base: Date, minutes: number, secondsOffset = 0): string {
  return ts(new Date(base.getTime() - minutes * 60 * 1000 + secondsOffset * 1000));
}

function buildScenarios(now: Date): Array<{ name: string; events: IngestEventInput[] }> {
  // IMPORTANT: every scenario array MUST be ordered oldest-first. Detection
  // windows look backwards from each event, so ingesting newest-first would
  // leave every window containing only the event itself and nothing would
  // ever trigger.
  const bruteForce: IngestEventInput[] = Array.from({ length: 7 }, (_, i) => ({
    timestamp: minutesAgo(now, 3.5, i * 15),
    eventType: 'ssh_failed_login',
    severity: 'HIGH',
    sourceIp: '203.0.113.99',
    destIp: '10.0.0.5',
    username: 'root',
    metadata: { attempts: i + 1, port: 22, protocol: 'ssh' },
  }));

  const portScan: IngestEventInput[] = Array.from({ length: 22 }, (_, i) => ({
    timestamp: minutesAgo(now, 1, -((21 - i) * 2)),
    eventType: 'connection_attempt',
    severity: 'MEDIUM',
    sourceIp: '198.51.100.44',
    destIp: '10.0.0.5',
    username: null,
    metadata: { port: 4000 + i, protocol: 'tcp' },
  }));

  const c2Beacon: IngestEventInput[] = Array.from({ length: 12 }, (_, i) => ({
    timestamp: minutesAgo(now, 44 - i * 4),
    eventType: 'dns_query',
    severity: 'MEDIUM',
    sourceIp: '10.9.8.7',
    destIp: '8.8.8.8',
    username: null,
    metadata: { domain: 'evil.example.com', queryType: 'A' },
  }));

  const malware: IngestEventInput[] = Array.from({ length: 4 }, (_, i) => ({
    timestamp: minutesAgo(now, 20 - i * 2),
    eventType: 'file_modification',
    severity: 'CRITICAL',
    sourceIp: '10.0.7.15',
    destIp: null,
    username: 'SYSTEM',
    metadata: { filePath: 'C:\\Windows\\Temp\\payload.exe', operation: 'create' },
  }));

  const iocTraffic: IngestEventInput[] = Array.from({ length: 3 }, (_, i) => ({
    timestamp: minutesAgo(now, 9 - i),
    eventType: 'http_request',
    severity: 'LOW',
    sourceIp: '192.168.100.50',
    destIp: '10.0.0.5',
    username: null,
    metadata: { url: 'http://192.168.100.50/beacon' },
  }));

  const benign: IngestEventInput[] = Array.from({ length: 8 }, (_, i) => ({
    timestamp: minutesAgo(now, 50 - i * 5),
    eventType: 'user_logon',
    severity: 'INFO',
    sourceIp: `10.0.1.${10 + i}`,
    destIp: null,
    username: `user${i}`,
    metadata: {},
  }));

  return [
    { name: 'SSH brute force', events: bruteForce },
    { name: 'Port scan', events: portScan },
    { name: 'C2 beaconing', events: c2Beacon },
    { name: 'Malware file drops', events: malware },
    { name: 'Known-bad IOC traffic', events: iocTraffic },
    { name: 'Benign background', events: benign },
  ];
}

/**
 * Runs a canned multi-scenario attack through the REAL ingestion pipeline
 * (persist -> IOC match -> rule detection -> alert + ML), then auto-groups
 * the resulting alerts into incidents. Used by the demo/test UI controls.
 */
export async function runDemoAttack(options: {
  ipAddress?: string;
  userId?: string | null;
} = {}): Promise<DemoAttackResult> {
  let source = await prisma.eventSource.findFirst({ where: { name: 'Demo Attack' } });
  if (!source) {
    source = await prisma.eventSource.create({
      data: {
        name: 'Demo Attack',
        apiKeyHash: randomBytes(32).toString('hex'),
        type: 'AGENT',
        description: 'Synthetic attack traffic generated from the UI demo controls',
        isActive: true,
      },
    });
  } else if (!source.isActive) {
    source = await prisma.eventSource.update({
      where: { id: source.id },
      data: { isActive: true },
    });
  }
  await prisma.eventSource.update({
    where: { id: source.id },
    data: { lastSeenAt: new Date() },
  });

  const now = new Date();
  const scenarios = buildScenarios(now);
  const results: DemoScenarioResult[] = [];

  let ingested = 0;
  let duplicates = 0;
  let alertsCreated = 0;
  let iocMatches = 0;

  for (const scenario of scenarios) {
    const result = await ingestEvents({
      sourceId: source.id,
      events: scenario.events,
      ipAddress: options.ipAddress,
      userId: options.userId ?? null,
    });
    ingested += result.ingested;
    duplicates += result.duplicates;
    alertsCreated += result.alertsCreated.length;
    iocMatches += result.iocMatches;
    results.push({ name: scenario.name, ingested: result.ingested, alertsCreated: result.alertsCreated.length });
    logger.info(
      { scenario: scenario.name, ingested: result.ingested, alerts: result.alertsCreated.length },
      'Demo attack scenario complete'
    );
  }

  const incidents = await incidentService(prisma).autoGroupAlerts({});

  return {
    ingested,
    duplicates,
    alertsCreated,
    iocMatches,
    incidentsCreated: incidents.length,
    scenarios: results,
  };
}
