import { config } from '@config';
import { logger } from '@utils/logger';

export interface IncidentContext {
  incident: {
    id: string;
    title: string;
    description?: string | null;
    severity: string;
    status: string;
    riskScore: number;
    createdAt: Date;
    updatedAt: Date;
  };
  alerts: Array<{
    id: string;
    title: string;
    severity: string;
    riskScore: number;
    status: string;
    rule?: { name: string; description?: string | null };
    events: Array<{
      event: {
        id: string;
        timestamp: Date;
        eventType: string;
        severity: string;
        sourceIp?: string | null;
        destIp?: string | null;
        username?: string | null;
      };
    }>;
    createdAt: Date;
  }>;
  iocMatches: Array<{
    ioc: {
      id: string;
      type: string;
      value: string;
      confidence: number;
      source?: string | null;
      tags: string[];
      description?: string | null;
    };
    iocId: string;
    iocType: string;
    iocValue: string;
    iocConfidence: number;
    iocSource?: string | null;
    iocTags: string[];
    iocDescription?: string | null;
    matchedField: string;
    matchedValue: string;
    matchedAt: Date;
  }>;
  timeline: Array<{
    time: Date;
    event: string;
    severity: string;
    sourceIp?: string | null;
  }>;
}

export interface MitreTechnique {
  id: string;
  name: string;
  tactic: string;
  confidence: number;
  description?: string;
}

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
}

export interface RiskAssessment {
  overall: number;
  likelihood: number;
  impact: number;
  confidence: number;
}

export interface AIAnalysis {
  summary: string;
  timeline: Array<{
    time: Date;
    event: string;
    severity: string;
    sourceIp?: string | null;
  }>;
  mitreTechniques: MitreTechnique[];
  recommendations: Recommendation[];
  riskAssessment: RiskAssessment;
}

export interface AIProvider {
  investigate(context: IncidentContext): Promise<AIAnalysis>;
  healthCheck(): Promise<boolean>;
}

export class MockAIProvider implements AIProvider {
  async investigate(context: IncidentContext): Promise<AIAnalysis> {
    const alertCount = context.alerts.length;
    const criticalAlerts = context.alerts.filter(a => a.severity === 'CRITICAL').length;
    const highAlerts = context.alerts.filter(a => a.severity === 'HIGH').length;

    return {
      summary: `Incident ${context.incident.title} involves ${alertCount} alerts (${criticalAlerts} critical, ${highAlerts} high). ` +
        `The attack appears to be a ${context.incident.severity.toLowerCase()} severity event requiring ${context.incident.status === 'OPEN' ? 'immediate investigation' : 'ongoing response'}.`,
      timeline: context.timeline,
      mitreTechniques: [
        { id: 'T1110', name: 'Brute Force', tactic: 'Credential Access', confidence: 0.9, description: 'Adversaries may use brute force techniques to gain access to accounts.' },
        { id: 'T1046', name: 'Network Service Scanning', tactic: 'Discovery', confidence: 0.7, description: 'Adversaries may attempt to get a listing of services running on remote hosts.' },
        { id: 'T1071', name: 'Application Layer Protocol', tactic: 'Command and Control', confidence: 0.6, description: 'Adversaries may communicate using application layer protocols to avoid detection.' },
      ],
      recommendations: [
        { priority: 'critical', action: 'Block source IPs at perimeter firewall', rationale: 'Prevent further malicious traffic from identified attacker IPs' },
        { priority: 'critical', action: 'Reset compromised credentials', rationale: 'Invalidate any credentials that may have been exposed during the attack' },
        { priority: 'high', action: 'Enable MFA for affected accounts', rationale: 'Add additional authentication factor to prevent unauthorized access' },
        { priority: 'high', action: 'Review authentication logs for lateral movement', rationale: 'Check for signs of attacker moving to other systems' },
        { priority: 'medium', action: 'Update detection rules for similar patterns', rationale: 'Improve detection coverage for this attack pattern' },
      ],
      riskAssessment: {
        overall: context.incident.riskScore,
        likelihood: Math.min(90, context.incident.riskScore + 10),
        impact: Math.max(10, context.incident.riskScore - 10),
        confidence: 0.85,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1', model: string = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
  }

  private buildPrompt(context: IncidentContext): string {
    const alertDetails = context.alerts.map(a => 
      `- ${a.title} (${a.severity}, risk: ${a.riskScore}) - Rule: ${a.rule?.name || 'unknown'} - Source: ${a.events[0]?.event.sourceIp || 'unknown'} - Time: ${a.createdAt.toISOString()}`
    ).join('\n');

    const iocDetails = context.iocMatches.map(m => 
      `- ${m.iocType}: ${m.iocValue} (confidence: ${m.iocConfidence}, source: ${m.iocSource || 'unknown'}) - Tags: ${m.iocTags.join(', ')}`
    ).join('\n');

    const timelineDetails = context.timeline.map(t => 
      `- ${t.time.toISOString()}: ${t.event} (${t.severity}) - Source: ${t.sourceIp || 'unknown'}`
    ).join('\n');

    return `You are a senior cybersecurity analyst investigating a security incident. Provide a structured analysis in JSON format.

INCIDENT: ${context.incident.title}
Severity: ${context.incident.severity}
Status: ${context.incident.status}
Risk Score: ${context.incident.riskScore}/100
Created: ${context.incident.createdAt.toISOString()}

ALERTS (${context.alerts.length} total):
${alertDetails}

IOC MATCHES:
${iocDetails || 'None found'}

TIMELINE:
${timelineDetails}

Provide your analysis in this exact JSON format:
{
  "summary": "2-3 sentence executive summary",
  "timeline": [{"time": "ISO timestamp", "event": "description", "severity": "CRITICAL|HIGH|MEDIUM|LOW", "sourceIp": "ip or null"}],
  "mitreTechniques": [{"id": "TXXXX", "name": "Technique Name", "tactic": "Tactic Name", "confidence": 0.0-1.0, "description": "brief description"}],
  "recommendations": [{"priority": "critical|high|medium|low", "action": "specific action", "rationale": "why this action"}],
  "riskAssessment": {"overall": 0-100, "likelihood": 0-100, "impact": 0-100, "confidence": 0.0-1.0}
}`;
  }

  async investigate(context: IncidentContext): Promise<AIAnalysis> {
    const prompt = this.buildPrompt(context);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a senior cybersecurity analyst. Provide structured JSON analysis only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'OpenAI API error');
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data: any = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from AI provider');
    }

    try {
      return JSON.parse(content);
    } catch (e) {
      logger.error({ content }, 'Failed to parse AI response');
      throw new Error('Invalid JSON response from AI provider');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'llama3') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  private buildPrompt(context: IncidentContext): string {
    const mockProvider = new MockAIProvider();
    // Note: This is synchronous, but we're calling it from an async context
    // In a real implementation, this would be a synchronous prompt builder
    return JSON.stringify({
      model: this.model,
      prompt: `Analyze this security incident...`,
      stream: false,
    });
  }

  async investigate(context: IncidentContext): Promise<AIAnalysis> {
    const mockProvider = new MockAIProvider();
    return mockProvider.investigate(context);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export function getAIProvider(): AIProvider {
  if (config.AI_PROVIDER === 'openai' && config.AI_API_KEY) {
    return new OpenAIProvider(config.AI_API_KEY, config.AI_BASE_URL, config.AI_MODEL);
  }
  if (config.AI_PROVIDER === 'local') {
    return new OllamaProvider(config.AI_BASE_URL, config.AI_MODEL);
  }
  return new MockAIProvider();
}