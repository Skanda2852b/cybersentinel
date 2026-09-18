import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useAuthStore } from '@/store/authStore';
import type {
  User,
  Event,
  Alert,
  Incident,
  IOC,
  DetectionRule,
  DashboardStats,
  PaginatedResponse,
  TimeSeriesPoint,
} from '@/types/api';

// Authenticated queries stay dormant until login so logged-out renders
// never fire API calls (which would just 401 + spam the console).
function useIsAuthenticated() {
  return useAuthStore((s) => s.isAuthenticated);
}

// Auth
export function useLogin() {
  return useMutation({
    mutationFn: (credentials: { email: string; password: string; remember?: boolean }) =>
      api.post('/auth/login', credentials),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
      api.post('/auth/register', data),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
  });
}

export function useMe() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<User>('/auth/me').then(r => r.data),
    retry: false,
    staleTime: Infinity,
    enabled: isAuthenticated,
  });
}

export function useRefresh() {
  return useMutation({
    mutationFn: () => api.post('/auth/refresh'),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: { firstName?: string | null; lastName?: string | null }) =>
      api.patch<User>('/auth/me', profile).then(r => r.data),
    onSuccess: (user) => {
      queryClient.setQueryData(['auth', 'me'], user);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post('/auth/change-password', data).then(r => r.data),
  });
}

export interface SystemStatus {
  version: string;
  environment: string;
  backend: string;
  database: 'connected' | 'disconnected';
  mlService: {
    status: string;
    version: string;
    modelLoaded: boolean;
    endpoint: string;
  };
  ai: {
    provider: string;
    healthy: boolean;
    model: string;
  };
}

export function useSystemStatus() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['system', 'status'],
    queryFn: () => api.get<SystemStatus>('/system/status').then(r => r.data),
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });
}

// Dashboard
export function useDashboardStats() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => api.get<DashboardStats>('/analytics/dashboard').then(r => r.data),
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });
}

export function useTimeSeries(metric: 'events' | 'alerts', interval = '1h', hours = 24) {
  const isAuthenticated = useIsAuthenticated();
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return useQuery({
    queryKey: ['analytics', 'timeseries', metric, interval, hours],
    queryFn: () => api.get<{ data: TimeSeriesPoint[] }>('/analytics/timeseries', {
      params: { metric, interval, startTime },
    }).then(r => r.data),
    refetchInterval: 60000,
    enabled: isAuthenticated,
  });
}

// Events
interface EventsParams {
  page?: number;
  limit?: number;
  startTime?: string;
  endTime?: string;
  eventType?: string;
  severity?: string;
  sourceIp?: string;
  destIp?: string;
  username?: string;
  sourceId?: string;
  search?: string;
}

export function useEvents(params: EventsParams = {}) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['events', params],
    queryFn: () => api.get<PaginatedResponse<Event>>('/events', { params }).then(r => r.data),
    placeholderData: (previous) => previous,
    enabled: isAuthenticated,
  });
}

export function useEvent(id: string) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['events', id],
    queryFn: () => api.get<Event>(`/events/${id}`).then(r => r.data),
    enabled: !!id && isAuthenticated,
  });
}

// Event Sources
export function useEventSources() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['event-sources'],
    queryFn: () => api.get('/event-sources').then(r => r.data),
    enabled: isAuthenticated,
  });
}

export function useCreateEventSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; type: string; description?: string }) =>
      api.post('/event-sources', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-sources'] }),
  });
}

export function useDeleteEventSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/event-sources/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-sources'] }),
  });
}

// Alerts
interface AlertsParams {
  page?: number;
  limit?: number;
  status?: string;
  severity?: string;
  ruleId?: string;
  startTime?: string;
  endTime?: string;
  search?: string;
}

export function useAlerts(params: AlertsParams = {}) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => api.get<PaginatedResponse<Alert>>('/alerts', { params }).then(r => r.data),
    placeholderData: (previous) => previous,
    enabled: isAuthenticated,
  });
}

export function useAlert(id: string) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['alerts', id],
    queryFn: () => api.get<Alert>(`/alerts/${id}`).then(r => r.data),
    enabled: !!id && isAuthenticated,
  });
}

export function useUpdateAlertStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Alert['status'] }) =>
      api.patch(`/alerts/${id}/status`, { status }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts', id] });
    },
  });
}

// Incidents
interface IncidentsParams {
  page?: number;
  limit?: number;
  status?: string;
  severity?: string;
  assignedUserId?: string;
  search?: string;
}

export function useIncidents(params: IncidentsParams = {}) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['incidents', params],
    queryFn: () => api.get<PaginatedResponse<Incident>>('/incidents', { params }).then(r => r.data),
    placeholderData: (previous) => previous,
    enabled: isAuthenticated,
  });
}

export function useIncident(id: string) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['incidents', id],
    queryFn: () => api.get<Incident>(`/incidents/${id}`).then(r => r.data),
    enabled: !!id && isAuthenticated,
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      severity: Incident['severity'];
      alertIds: string[];
      assignedUserId?: string;
    }) => api.post('/incidents', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  });
}

export function useUpdateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Incident>) =>
      api.patch(`/incidents/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incidents', id] });
    },
  });
}

export function useAddIncidentNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ incidentId, content }: { incidentId: string; content: string }) =>
      api.post(`/incidents/${incidentId}/notes`, { content }),
    onSuccess: (_, { incidentId }) => {
      queryClient.invalidateQueries({ queryKey: ['incidents', incidentId] });
    },
  });
}

// IOCs
interface IOCsParams {
  page?: number;
  limit?: number;
  type?: string;
  isActive?: boolean;
  search?: string;
}

export function useIOCs(params: IOCsParams = {}) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['iocs', params],
    queryFn: () => api.get<PaginatedResponse<IOC>>('/iocs', { params }).then(r => r.data),
    placeholderData: (previous) => previous,
    enabled: isAuthenticated,
  });
}

export function useCreateIOC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      type: IOC['type'];
      value: string;
      confidence?: number;
      source?: string;
      tags?: string[];
      description?: string;
      isActive?: boolean;
    }) => api.post('/iocs', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iocs'] }),
  });
}

export function useDeleteIOC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/iocs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iocs'] }),
  });
}

// Detection Rules
export interface RuleInput {
  name: string;
  description?: string;
  enabled?: boolean;
  severity: DetectionRule['severity'];
  logic: Record<string, unknown>;
}

// AI Investigation
export function useAIInvestigation() {
  return useMutation({
    mutationFn: (incidentId: string) =>
      api.post('/ai/investigate', { incidentId }).then(r => r.data),
  });
}

export function useAIHealth() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['ai', 'health'],
    queryFn: () => api.get('/ai/health').then(r => r.data),
    refetchInterval: 60000,
    enabled: isAuthenticated,
  });
}

// Detection Rules
export function useDetectionRules() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['detection-rules'],
    queryFn: () => api.get<DetectionRule[]>('/detection-rules').then(r => r.data),
    enabled: isAuthenticated,
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RuleInput) => api.post('/detection-rules', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['detection-rules'] }),
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<RuleInput>) =>
      api.patch(`/detection-rules/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['detection-rules'] }),
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/detection-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['detection-rules'] }),
  });
}

export function useAutoGroupAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options?: { timeWindowHours?: number; groupBySourceIp?: boolean; groupByRule?: boolean; minAlertsPerIncident?: number }) =>
      api.post('/incidents/auto-group', options ?? {}).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

// Audit Logs
interface AuditLogsParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  startTime?: string;
  endTime?: string;
}

export function useAuditLogs(params: AuditLogsParams = {}) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => api.get<PaginatedResponse<any>>('/audit-logs', { params }).then(r => r.data),
    enabled: isAuthenticated,
  });
}

// Admin: demo data + live-fire testing
export interface DemoAttackResult {
  ingested: number;
  duplicates: number;
  alertsCreated: number;
  iocMatches: number;
  incidentsCreated: number;
  scenarios: Array<{ name: string; ingested: number; alertsCreated: number }>;
}

export interface ResetResult {
  deleted: Record<string, number>;
}

function invalidateTelemetry(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['analytics'] });
  queryClient.invalidateQueries({ queryKey: ['alerts'] });
  queryClient.invalidateQueries({ queryKey: ['incidents'] });
  queryClient.invalidateQueries({ queryKey: ['events'] });
  queryClient.invalidateQueries({ queryKey: ['system'] });
}

export function useResetDemoData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ResetResult>('/admin/reset').then(r => r.data),
    onSuccess: () => invalidateTelemetry(queryClient),
  });
}

export function useRunDemoAttack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<DemoAttackResult>('/admin/demo/attack').then(r => r.data),
    onSuccess: () => invalidateTelemetry(queryClient),
  });
}

// Health & Ready
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then(r => r.data),
    refetchInterval: 30000,
  });
}

export function useReady() {
  return useQuery({
    queryKey: ['ready'],
    queryFn: () => api.get('/ready').then(r => r.data),
    refetchInterval: 10000,
  });
}