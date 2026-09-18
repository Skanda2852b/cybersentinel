import { PrismaClient, Incident, IncidentStatus, Severity, Alert, User, DetectionRule, Event } from '@prisma/client';

export interface AlertWithRule extends Alert {
  rule?: DetectionRule | null;
  events?: Array<{ event: Event }>;
}

export interface IncidentWithAlerts extends Incident {
  alerts: Array<{ alert: AlertWithRule }>;
  assignedUser?: User | null;
  notes: Array<{ user: User }>;
}

export interface AutoGroupOptions {
  timeWindowHours?: number;
  groupBySourceIp?: boolean;
  groupByRule?: boolean;
  minAlertsPerIncident?: number;
}

export class IncidentService {
  constructor(private prisma: PrismaClient) {}

  async createFromAlerts(
    alertIds: string[],
    title: string,
    userId: string,
    options: { description?: string; severity?: Severity; assignedUserId?: string; note?: string } = {}
  ): Promise<Incident> {
    const alerts = await this.prisma.alert.findMany({
      where: { id: { in: alertIds } },
      include: { rule: true },
    });

    if (alerts.length === 0) {
      throw new Error('No valid alerts provided');
    }

    const severity = options.severity || this.determineSeverity(alerts);
    const riskScore = this.calculateIncidentRiskScore(alerts);

    const incident = await this.prisma.incident.create({
      data: {
        title,
        description: options.description || this.generateDescription(alerts),
        severity,
        status: 'OPEN',
        riskScore,
        assignedUserId: options.assignedUserId,
        alerts: {
          create: alertIds.map(alertId => ({ alertId })),
        },
        // The initial note is opt-in so automated flows (which have no real
        // author) never fabricate authorship or violate the user FK.
        notes: options.note ? {
          create: { userId, content: options.note },
        } : undefined,
      },
      include: { alerts: { include: { alert: true } }, assignedUser: true },
    });

    await this.prisma.alert.updateMany({
      where: { id: { in: alertIds } },
      data: { status: 'INVESTIGATING' },
    });

    return incident;
  }

  async autoGroupAlerts(options: AutoGroupOptions = {}): Promise<Incident[]> {
    const {
      timeWindowHours = 4,
      groupBySourceIp = true,
      groupByRule = false,
      minAlertsPerIncident = 2,
    } = options;

    const cutoff = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

    const openAlerts = await this.prisma.alert.findMany({
      where: {
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        createdAt: { gte: cutoff },
      },
      include: { rule: true, events: { include: { event: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (openAlerts.length < minAlertsPerIncident) return [];

    const groups = new Map<string, AlertWithRule[]>();

    for (const alert of openAlerts) {
      const groupKey = this.getGroupKey(alert, { groupBySourceIp, groupByRule });
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(alert);
    }

    const createdIncidents: Incident[] = [];

    for (const [groupKey, alerts] of groups.entries()) {
      if (alerts.length < minAlertsPerIncident) continue;

      const existingIncident = await this.findExistingIncident(alerts);
      if (existingIncident) {
        const newAlertIds = alerts.filter(a => !existingIncident.alerts.some(ia => ia.alertId === a.id))
          .map(a => a.id);
        if (newAlertIds.length > 0) {
          await this.addAlertsToIncident(existingIncident.id, newAlertIds);
        }
        continue;
      }

      const incident = await this.createFromAlerts(
        alerts.map(a => a.id),
        this.generateGroupTitle(groupKey, alerts),
        'system',
        { description: this.generateGroupDescription(alerts) }
      );
      createdIncidents.push(incident);
    }

    return createdIncidents;
  }

  async addAlertsToIncident(incidentId: string, alertIds: string[]): Promise<Incident> {
    await this.prisma.incidentAlert.createMany({
      data: alertIds.map(alertId => ({ incidentId, alertId })),
      skipDuplicates: true,
    });

    await this.prisma.alert.updateMany({
      where: { id: { in: alertIds } },
      data: { status: 'INVESTIGATING' },
    });

    return this.updateIncidentRiskScore(incidentId);
  }

  async removeAlertFromIncident(incidentId: string, alertId: string): Promise<void> {
    await this.prisma.incidentAlert.delete({
      where: { incidentId_alertId: { incidentId, alertId } },
    });

    const remaining = await this.prisma.incidentAlert.findMany({
      where: { incidentId },
      select: { alertId: true },
    });

    if (remaining.length === 0) {
      await this.updateStatus(incidentId, 'CLOSED');
    } else {
      await this.updateIncidentRiskScore(incidentId);
    }
  }

  async updateStatus(incidentId: string, status: IncidentStatus): Promise<Incident> {
    const updateData: any = { status, lastSeen: new Date() };
    if (status === 'CLOSED' || status === 'RECOVERED') updateData.resolvedAt = new Date();

    return this.prisma.incident.update({
      where: { id: incidentId },
      data: updateData,
    });
  }

  async assign(incidentId: string, assigneeId: string): Promise<Incident> {
    return this.prisma.incident.update({
      where: { id: incidentId },
      data: { assignedUserId: assigneeId, status: 'INVESTIGATING' },
    });
  }

  async addNote(incidentId: string, userId: string, content: string) {
    return this.prisma.incidentNote.create({
      data: { incidentId, userId, content },
      include: { user: true },
    });
  }

  async getIncidentWithContext(incidentId: string): Promise<IncidentWithAlerts | null> {
    return this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        assignedUser: true,
        alerts: { include: { alert: { include: { rule: true, events: { include: { event: true } } } } } },
        notes: { include: { user: true }, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  private async findExistingIncident(alerts: AlertWithRule[]): Promise<Incident & { alerts: Array<{ alertId: string }> } | null> {
    const alertIds = alerts.map(a => a.id);
    const incidents = await this.prisma.incident.findMany({
      where: {
        status: { in: ['OPEN', 'INVESTIGATING'] },
        alerts: { some: { alertId: { in: alertIds } } },
      },
      include: { alerts: { select: { alertId: true } } },
    });

    const incidentsWithAlerts = incidents as (Incident & { alerts: Array<{ alertId: string }> })[];

    for (const incident of incidentsWithAlerts) {
      const incidentAlertIds = new Set(incident.alerts.map(a => a.alertId));
      const overlap = alertIds.filter(id => incidentAlertIds.has(id)).length;
      if (overlap >= Math.min(2, alertIds.length * 0.5)) {
        return incident;
      }
    }
    return null;
  }

  private async updateIncidentRiskScore(incidentId: string): Promise<Incident> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { alerts: { include: { alert: { include: { rule: true } } } } },
    });

    if (!incident) throw new Error('Incident not found');

    const riskScore = this.calculateIncidentRiskScore(incident.alerts.map(a => a.alert));

    return this.prisma.incident.update({
      where: { id: incidentId },
      data: { riskScore, lastSeen: new Date() },
    });
  }

  private determineSeverity(alerts: Alert[]): Severity {
    // Order is highest-severity-first, so the maximum is the lowest index.
    const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    let maxSeverity: Severity = 'INFO';
    for (const alert of alerts) {
      if (severityOrder.indexOf(alert.severity) < severityOrder.indexOf(maxSeverity)) {
        maxSeverity = alert.severity;
      }
    }
    return maxSeverity;
  }

  private alertSourceIp(alert: AlertWithRule): string {
    return alert.events?.[0]?.event.sourceIp || 'unknown';
  }

  private calculateIncidentRiskScore(alerts: Alert[]): number {
    if (alerts.length === 0) return 0;
    const scores = alerts.map(a => a.riskScore);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    return Math.round((avg + max) / 2);
  }

  private getGroupKey(alert: AlertWithRule, options: { groupBySourceIp: boolean; groupByRule: boolean }): string {
    const parts: string[] = [];
    if (options.groupByRule) parts.push(`rule:${alert.ruleId}`);
    if (options.groupBySourceIp) {
      parts.push(`ip:${this.alertSourceIp(alert)}`);
    }
    return parts.join('|') || 'default';
  }

  private generateGroupTitle(groupKey: string, alerts: AlertWithRule[]): string {
    const ruleNames = [...new Set(alerts.map(a => a.rule?.name).filter(Boolean))];
    const sourceIps = [...new Set(alerts.map(a => this.alertSourceIp(a)).filter((ip) => ip !== 'unknown'))];
    return `Auto-grouped: ${ruleNames.join(', ')} from ${sourceIps.join(', ') || 'unknown sources'} (${alerts.length} alerts)`;
  }

  private generateDescription(alerts: AlertWithRule[]): string {
    const ruleNames = [...new Set(alerts.map(a => a.rule?.name).filter(Boolean))];
    return `Auto-created incident from ${alerts.length} alerts triggered by rules: ${ruleNames.join(', ')}.`;
  }

  private generateGroupDescription(alerts: AlertWithRule[]): string {
    const timeRange = `${new Date(Math.min(...alerts.map(a => a.createdAt.getTime()))).toISOString()} to ${new Date(Math.max(...alerts.map(a => a.createdAt.getTime()))).toISOString()}`;
    const ruleNames = [...new Set(alerts.map(a => a.rule?.name).filter(Boolean))];
    return `Auto-grouped ${alerts.length} alerts (${timeRange}). Rules: ${ruleNames.join(', ')}.`;
  }
}

export const incidentService = (prisma: PrismaClient) => new IncidentService(prisma);