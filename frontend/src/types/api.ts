export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'ANALYST' | 'VIEWER';
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface EventSource {
  id: string;
  name: string;
  type: 'AGENT' | 'SYSLOG' | 'API' | 'CLOUD' | 'NETWORK';
  description?: string;
  isActive: boolean;
  lastSeenAt?: string;
  createdAt: string;
}

export interface Event {
  id: string;
  sourceId: string;
  source?: EventSource;
  timestamp: string;
  eventType: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  sourceIp?: string;
  destIp?: string;
  username?: string;
  dedupHash: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DetectionRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  logic: Record<string, unknown>;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  rule?: DetectionRule;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  riskScore: number;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  title: string;
  description?: string;
  explanation?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface Incident {
  id: string;
  title: string;
  description?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  status: 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'ERADICATED' | 'RECOVERED' | 'CLOSED';
  riskScore: number;
  assignedUserId?: string;
  assignedUser?: User;
  firstSeen: string;
  lastSeen: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  alerts?: Array<{ alert: Alert }>;
}

export interface IncidentNote {
  id: string;
  incidentId: string;
  userId: string;
  user?: User;
  content: string;
  createdAt: string;
}

export interface IOC {
  id: string;
  type: 'IP' | 'DOMAIN' | 'URL' | 'HASH_MD5' | 'HASH_SHA1' | 'HASH_SHA256' | 'EMAIL' | 'CIDR' | 'REGISTRY_KEY' | 'MUTEX';
  value: string;
  confidence: number;
  source?: string;
  tags: string[];
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MLPrediction {
  id: string;
  eventId: string;
  alertId?: string;
  anomalyScore: number;
  modelVersion: string;
  featuresUsed: Record<string, unknown>;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface DashboardStats {
  totalEvents: number;
  totalAlerts: number;
  openAlerts: number;
  totalIncidents: number;
  openIncidents: number;
  criticalAlerts: number;
  eventsLast24h: number;
  alertsLast24h: number;
  trends: {
    totalEvents: string;
    totalAlerts: string;
    openAlerts: string;
    totalIncidents: string;
    openIncidents: string;
    criticalAlerts: string;
  };
  topSourceIps: Array<{ ip: string; count: number }>;
  topEventTypes: Array<{ type: string; count: number }>;
  severityDistribution: Array<{ severity: string; count: number }>;
  eventsTimeSeries: TimeSeriesPoint[];
  alertsTimeSeries: TimeSeriesPoint[];
}