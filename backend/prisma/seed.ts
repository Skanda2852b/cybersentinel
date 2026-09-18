import { PrismaClient, Role, SourceType, Severity } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('admin123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@cybersentinel.local' },
    update: {},
    create: {
      email: 'admin@cybersentinel.local',
      passwordHash,
      role: Role.ADMIN,
      firstName: 'Admin',
      lastName: 'User',
    },
  });

  const analyst = await prisma.user.upsert({
    where: { email: 'analyst@cybersentinel.local' },
    update: {},
    create: {
      email: 'analyst@cybersentinel.local',
      passwordHash: await bcrypt.hash('analyst123', 12),
      role: Role.ANALYST,
      firstName: 'Security',
      lastName: 'Analyst',
    },
  });

  console.log('Created users:', { admin: admin.email, analyst: analyst.email });

  // SHA-256 of the default dev key 'local-dev-ingestion-key-change-in-prod'
  // (see .env.example and simulator --api-key default) so the simulator
  // works out of the box after seeding. Never store or log raw keys.
  const source = await prisma.eventSource.upsert({
    where: { apiKeyHash: 'fb5fd0b336597660f86555ecf247ce0b81f490792fa7d9da24edcae2ba5752fa' },
    update: {},
    create: {
      name: 'Development Simulator',
      apiKeyHash: 'fb5fd0b336597660f86555ecf247ce0b81f490792fa7d9da24edcae2ba5752fa',
      type: SourceType.AGENT,
      description: 'Default development source for the attack simulator',
      isActive: true,
    },
  });

  console.log('Created event source:', source.name);

  // NOTE: update payloads intentionally overwrite logic/enabled/severity so
  // re-running the seed heals rule definitions already stored in the DB.
  const rules = await Promise.all([
    prisma.detectionRule.upsert({
      where: { id: 'rule-brute-force' },
      update: {
        enabled: true,
        severity: Severity.HIGH,
        logic: {
          condition: 'AND',
          rules: [
            { field: 'eventType', operator: 'equals', value: 'ssh_failed_login' },
            { aggregation: 'count', operator: 'gte', value: 5, window: '5m', groupBy: 'sourceIp' },
          ],
        },
      },
      create: {
        id: 'rule-brute-force',
        name: 'SSH Brute Force Detection',
        description: 'Detects multiple failed SSH login attempts from same IP',
        enabled: true,
        severity: Severity.HIGH,
        logic: {
          condition: 'AND',
          rules: [
            { field: 'eventType', operator: 'equals', value: 'ssh_failed_login' },
            { aggregation: 'count', operator: 'gte', value: 5, window: '5m', groupBy: 'sourceIp' },
          ],
        },
      },
    }),
    prisma.detectionRule.upsert({
      where: { id: 'rule-port-scan' },
      update: {
        enabled: true,
        severity: Severity.MEDIUM,
        logic: {
          condition: 'AND',
          rules: [
            { field: 'eventType', operator: 'equals', value: 'connection_attempt' },
            { aggregation: 'uniqueCount', aggregationField: 'metadata.port', operator: 'gte', value: 20, window: '1m', groupBy: 'sourceIp' },
          ],
        },
      },
      create: {
        id: 'rule-port-scan',
        name: 'Port Scan Detection',
        description: 'Detects rapid connection attempts to multiple ports',
        enabled: true,
        severity: Severity.MEDIUM,
        logic: {
          condition: 'AND',
          rules: [
            { field: 'eventType', operator: 'equals', value: 'connection_attempt' },
            { aggregation: 'uniqueCount', aggregationField: 'metadata.port', operator: 'gte', value: 20, window: '1m', groupBy: 'sourceIp' },
          ],
        },
      },
    }),
    prisma.detectionRule.upsert({
      where: { id: 'rule-malware-c2' },
      update: {
        enabled: true,
        severity: Severity.CRITICAL,
        logic: {
          condition: 'AND',
          rules: [
            { field: 'eventType', operator: 'equals', value: 'dns_query' },
            { aggregation: 'count', operator: 'gte', value: 10, window: '1h', groupBy: ['sourceIp', 'destIp'] },
          ],
        },
      },
      create: {
        id: 'rule-malware-c2',
        name: 'Malware C2 Beaconing',
        description: 'Detects high-volume DNS querying (e.g. beaconing) between a source and destination',
        enabled: true,
        severity: Severity.CRITICAL,
        logic: {
          condition: 'AND',
          rules: [
            { field: 'eventType', operator: 'equals', value: 'dns_query' },
            { aggregation: 'count', operator: 'gte', value: 10, window: '1h', groupBy: ['sourceIp', 'destIp'] },
          ],
        },
      },
    }),
  ]);

  console.log('Created detection rules:', rules.map(r => r.name));

  const iocs = await Promise.all([
    prisma.iOC.upsert({
      where: { id: 'ioc-malicious-ip-1' },
      update: {},
      create: {
        id: 'ioc-malicious-ip-1',
        type: 'IP',
        value: '192.168.100.50',
        confidence: 0.95,
        source: 'Threat Feed Alpha',
        tags: ['malware', 'c2', 'apt29'],
        description: 'Known APT29 C2 server',
      },
    }),
    prisma.iOC.upsert({
      where: { id: 'ioc-malicious-domain-1' },
      update: {},
      create: {
        id: 'ioc-malicious-domain-1',
        type: 'DOMAIN',
        value: 'evil-c2.example.com',
        confidence: 0.9,
        source: 'Internal Analysis',
        tags: ['phishing', 'credential-harvesting'],
        description: 'Phishing domain for credential harvesting',
      },
    }),
    prisma.iOC.upsert({
      where: { id: 'ioc-malicious-hash-1' },
      update: {},
      create: {
        id: 'ioc-malicious-hash-1',
        type: 'HASH_SHA256',
        value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        confidence: 1.0,
        source: 'VirusTotal',
        tags: ['ransomware', 'lockbit'],
        description: 'LockBit ransomware sample',
      },
    }),
  ]);

  console.log('Created IOCs:', iocs.map(i => `${i.type}:${i.value}`));

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });