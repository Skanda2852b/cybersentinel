import { PrismaClient, Alert, AlertStatus, Severity, Event, DetectionRule } from '@prisma/client';
import { RiskEngine, RiskFactors } from './riskEngine';
import { getMLClient, NormalizedEvent } from './mlClient';
import { logger } from '@utils/logger';

export interface AlertWithEvents extends Alert {
  events: Array<{ event: Event }>;
  rule?: DetectionRule;
}

export class AlertService {
  private mlClient = getMLClient();

  constructor(private prisma: PrismaClient, private riskEngine: RiskEngine) {}

  async createFromRule(
    event: Event,
    rule: DetectionRule,
    matchedConditions: any[],
    mlAnomalyScore?: number
  ): Promise<Alert> {
    const normalizedEvent = this.mlClient.normalizeEvent(event);
    let mlScore = mlAnomalyScore;
    let mlPrediction: any = null;

    try {
      const mlResult = await this.mlClient.predictSingle(normalizedEvent);
      mlScore = mlResult.anomaly_score;
      mlPrediction = mlResult;
    } catch (error) {
      logger.warn({ err: error, eventId: event.id }, 'ML prediction failed, using fallback');
    }

    const riskScore = this.calculateRiskScore(event, rule, matchedConditions, mlScore);

    const alert = await this.prisma.alert.create({
      data: {
        ruleId: rule.id,
        severity: rule.severity,
        riskScore,
        status: 'OPEN',
        title: this.generateTitle(event, rule),
        description: this.generateDescription(event, rule, matchedConditions),
        explanation: this.generateExplanation(event, rule, matchedConditions),
        metadata: {
          matchedConditions,
          eventId: event.id,
          sourceId: event.sourceId,
          mlAnomalyScore: mlScore,
        },
        events: {
          create: { eventId: event.id },
        },
        mlPredictions: mlPrediction ? {
          create: {
            eventId: event.id,
            anomalyScore: mlPrediction.anomaly_score,
            modelVersion: mlPrediction.features_used?.model_version || 'unknown',
            featuresUsed: mlPrediction.features_used,
          },
        } : undefined,
      },
      include: { rule: true, events: { include: { event: true } }, mlPredictions: true },
    });

    return alert;
  }

  async createBulk(alertsData: Array<{
    event: Event;
    rule: DetectionRule;
    matchedConditions: any[];
    mlAnomalyScore?: number;
  }>): Promise<Alert[]> {
    const created: Alert[] = [];
    for (const data of alertsData) {
      const alert = await this.createFromRule(data.event, data.rule, data.matchedConditions, data.mlAnomalyScore);
      created.push(alert);
    }
    return created;
  }

  async updateStatus(alertId: string, status: AlertStatus, userId?: string): Promise<Alert> {
    const updateData: any = { status };
    if (status === 'ACKNOWLEDGED') updateData.acknowledgedAt = new Date();
    if (status === 'RESOLVED' || status === 'FALSE_POSITIVE') updateData.resolvedAt = new Date();

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'ALERT_STATUS_CHANGE',
          targetEntity: 'Alert',
          targetId: alertId,
          metadata: { status },
        },
      });
    }

    return this.prisma.alert.update({
      where: { id: alertId },
      data: updateData,
    });
  }

  async bulkUpdateStatus(alertIds: string[], status: AlertStatus, userId?: string): Promise<number> {
    const updateData: any = { status };
    if (status === 'ACKNOWLEDGED') updateData.acknowledgedAt = new Date();
    if (status === 'RESOLVED' || status === 'FALSE_POSITIVE') updateData.resolvedAt = new Date();

    const result = await this.prisma.alert.updateMany({
      where: { id: { in: alertIds } },
      data: updateData,
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'ALERT_BULK_STATUS_CHANGE',
          targetEntity: 'Alert',
          metadata: { alertIds, status, count: result.count },
        },
      });
    }

    return result.count;
  }

  async assignToIncident(alertIds: string[], incidentId: string): Promise<void> {
    await this.prisma.incidentAlert.createMany({
      data: alertIds.map(alertId => ({ incidentId, alertId })),
      skipDuplicates: true,
    });

    await this.prisma.alert.updateMany({
      where: { id: { in: alertIds } },
      data: { status: 'INVESTIGATING' },
    });
  }

  async getAlertWithContext(alertId: string): Promise<AlertWithEvents | null> {
    return this.prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        rule: true,
        events: { include: { event: true } },
        mlPredictions: true,
        incidents: { include: { incident: true } },
      },
    });
  }

  private calculateRiskScore(
    event: Event,
    rule: DetectionRule,
    matchedConditions: any[],
    mlAnomalyScore?: number
  ): number {
    const factors: RiskFactors = {
      baseSeverityWeight: this.getSeverityWeight(rule.severity),
      ruleConfidence: 0.8,
      sourceReputation: 0.5,
      assetCriticality: 0.5,
      timeOfDay: this.getTimeOfDayFactor(event.timestamp),
      userBehaviorAnomaly: 0.5,
      mlAnomalyScore: mlAnomalyScore || 0.5,
    };

    return this.riskEngine.calculate(factors);
  }

  private getSeverityWeight(severity: Severity): number {
    const weights = { CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25, INFO: 10 };
    return weights[severity] || 10;
  }

  private getTimeOfDayFactor(timestamp: Date): number {
    const hour = timestamp.getHours();
    if (hour >= 22 || hour <= 6) return 0.8;
    if (hour >= 18 || hour <= 8) return 0.6;
    return 0.4;
  }

  private generateTitle(event: Event, rule: DetectionRule): string {
    return `${rule.name}: ${event.eventType} from ${event.sourceIp || 'unknown'}`;
  }

  private generateDescription(event: Event, rule: DetectionRule, matchedConditions: any[]): string {
    return `Rule "${rule.name}" triggered by ${event.eventType} event from ${event.sourceIp || 'unknown source'}. ` +
      `Matched ${matchedConditions.length} condition(s).`;
  }

  private generateExplanation(event: Event, rule: DetectionRule, matchedConditions: any[]): string {
    return matchedConditions.map(c => 
      `${c.field} ${c.operator} ${JSON.stringify(c.value)}${c.window ? ` (window: ${c.window})` : ''}`
    ).join('; ');
  }
}

export const alertService = (prisma: PrismaClient, riskEngine: RiskEngine) => new AlertService(prisma, riskEngine);