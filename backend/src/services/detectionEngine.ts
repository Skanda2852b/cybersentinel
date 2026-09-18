import { PrismaClient, DetectionRule, Event, Severity } from '@prisma/client';

export interface RuleCondition {
  field?: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in';
  value: any;
  window?: string;
  groupBy?: string | string[];
  aggregation?: 'count' | 'uniqueCount' | 'sum' | 'avg';
  aggregationField?: string;
}

export interface RuleLogic {
  condition: 'AND' | 'OR';
  rules: RuleCondition[];
}

export interface TriggeredRule {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  matchedConditions: RuleCondition[];
  matchedAt: Date;
  rule: DetectionRule;
}

export interface EvaluationContext {
  event: Event;
  recentEvents: Event[];
  rule: DetectionRule;
}

export class DetectionEngine {
  constructor(private prisma: PrismaClient) {}

  async evaluateEvent(event: Event): Promise<TriggeredRule[]> {
    const enabledRules = await this.prisma.detectionRule.findMany({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
    });

    const triggeredRules: TriggeredRule[] = [];

    for (const rule of enabledRules) {
      const logic = rule.logic as unknown as RuleLogic;
      if (!logic || !logic.rules) continue;

      const context: EvaluationContext = {
        event,
        recentEvents: await this.getRecentEvents(event, logic),
        rule,
      };

      const matches = this.evaluateRuleLogic(logic, context);

      if (matches.matched) {
        triggeredRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          matchedConditions: matches.matchedConditions,
          matchedAt: new Date(),
          rule,
        });
      }
    }

    return triggeredRules;
  }

  async evaluateBatch(events: Event[]): Promise<Map<string, TriggeredRule[]>> {
    const result = new Map<string, TriggeredRule[]>();

    for (const event of events) {
      const triggered = await this.evaluateEvent(event);
      if (triggered.length > 0) {
        result.set(event.id, triggered);
      }
    }

    return result;
  }

  private async getRecentEvents(event: Event, logic: RuleLogic): Promise<Event[]> {
    const windowConditions = logic.rules.filter(r => r.window);
    if (windowConditions.length === 0) return [];

    const maxWindowMs = Math.max(...windowConditions.map(w => this.parseWindowToMs(w.window!)));
    const cutoff = new Date(event.timestamp.getTime() - maxWindowMs);

    return this.prisma.event.findMany({
      where: {
        sourceId: event.sourceId,
        timestamp: { gte: cutoff, lte: event.timestamp },
      },
      orderBy: { timestamp: 'asc' },
    });
  }

  private evaluateRuleLogic(logic: RuleLogic, context: EvaluationContext): { matched: boolean; matchedConditions: RuleCondition[] } {
    const results = logic.rules.map(condition => ({
      condition,
      matched: this.evaluateCondition(condition, context),
    }));

    const matchedConditions = results.filter(r => r.matched).map(r => r.condition);
    const allMatched = logic.condition === 'AND'
      ? results.every(r => r.matched)
      : results.some(r => r.matched);

    return { matched: allMatched, matchedConditions };
  }

  private static readonly AGGREGATION_NAMES: ReadonlySet<string> = new Set([
    'count',
    'uniqueCount',
    'sum',
    'avg',
  ]);

  private evaluateCondition(condition: RuleCondition, context: EvaluationContext): boolean {
    const { event, recentEvents } = context;

    // Canonical form uses `aggregation`; also accept the `field: 'count' | ...`
    // shorthand so rules written like the seeded ones still evaluate.
    const aggregation =
      condition.aggregation ??
      (condition.field && DetectionEngine.AGGREGATION_NAMES.has(condition.field)
        ? (condition.field as NonNullable<RuleCondition['aggregation']>)
        : undefined);

    if (condition.window && aggregation) {
      return this.evaluateWindowedCondition({ ...condition, aggregation }, event, recentEvents);
    }

    if (!condition.field) return false;
    const fieldValue = this.getFieldValue(event, condition.field);
    return this.compareValues(fieldValue, condition.operator, condition.value);
  }

  private evaluateWindowedCondition(condition: RuleCondition, event: Event, recentEvents: Event[]): boolean {
    const groupByFields = Array.isArray(condition.groupBy) ? condition.groupBy : condition.groupBy ? [condition.groupBy] : [];
    const windowMs = this.parseWindowToMs(condition.window!);
    const cutoff = new Date(event.timestamp.getTime() - windowMs);

    const windowEvents = recentEvents.filter(e => e.timestamp >= cutoff);

    let groupedEvents = windowEvents;
    if (groupByFields.length > 0) {
      const groupKey = groupByFields.map(f => this.getFieldValue(event, f)).join('|');
      groupedEvents = windowEvents.filter(e => groupByFields.map(f => this.getFieldValue(e, f)).join('|') === groupKey);
    }

    let aggregationValue: number;
    switch (condition.aggregation) {
      case 'count':
        aggregationValue = groupedEvents.length;
        break;
      case 'uniqueCount':
        const uniqueValues = new Set(groupedEvents.map(e => this.getFieldValue(e, condition.aggregationField!)));
        aggregationValue = uniqueValues.size;
        break;
      case 'sum':
        aggregationValue = groupedEvents.reduce((sum, e) => sum + (Number(this.getFieldValue(e, condition.aggregationField!)) || 0), 0);
        break;
      case 'avg':
        const values = groupedEvents.map(e => Number(this.getFieldValue(e, condition.aggregationField!)) || 0);
        aggregationValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      default:
        return false;
    }

    return this.compareValues(aggregationValue, condition.operator, condition.value);
  }

  private getFieldValue(obj: any, field: string): any {
    if (field.includes('.')) {
      return field.split('.').reduce((o, k) => o?.[k], obj);
    }
    return obj[field];
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals': return actual === expected;
      case 'not_equals': return actual !== expected;
      case 'contains': return String(actual).includes(String(expected));
      case 'gt': return Number(actual) > Number(expected);
      case 'gte': return Number(actual) >= Number(expected);
      case 'lt': return Number(actual) < Number(expected);
      case 'lte': return Number(actual) <= Number(expected);
      case 'in': return Array.isArray(expected) && expected.includes(actual);
      case 'not_in': return Array.isArray(expected) && !expected.includes(actual);
      default: return false;
    }
  }

  private parseWindowToMs(window: string): number {
    const match = window.match(/^(\d+)([mhd])$/);
    if (!match) return 5 * 60 * 1000;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 5 * 60 * 1000;
    }
  }
}

export const detectionEngine = (prisma: PrismaClient) => new DetectionEngine(prisma);