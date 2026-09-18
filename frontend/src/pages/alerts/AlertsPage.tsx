import { useState } from 'react';
import { Card, Badge, Button, Input, Modal, useToast } from '@/components/ui';
import { Search, Download, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useAlerts,
  useUpdateAlertStatus,
  useDetectionRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
} from '@/api/hooks';
import { useAuthStore } from '@/store/authStore';
import { downloadCsv } from '@/utils/csv';
import type { Alert } from '@/types/api';

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
const WINDOWS = [
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
] as const;
const GROUP_BYS = ['sourceIp', 'destIp', 'username'] as const;

export function AlertsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showRules, setShowRules] = useState(false);

  const { data, isLoading, error } = useAlerts({
    page,
    limit: 20,
    search: search || undefined,
    severity: severityFilter || undefined,
    status: statusFilter || undefined,
  });

  const updateStatus = useUpdateAlertStatus();

  const handleStatusChange = (alertId: string, status: Alert['status']) => {
    updateStatus.mutate({ id: alertId, status });
  };

  const handleExport = () => {
    const rows = (data?.data || []).map((a) => [
      a.id, a.title, a.severity, a.status, a.riskScore,
      (a.metadata?.sourceIp as string) || '', a.rule?.name || '', a.createdAt,
    ]);
    downloadCsv(
      `alerts-page${page}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['id', 'title', 'severity', 'status', 'riskScore', 'sourceIp', 'rule', 'createdAt'],
      rows
    );
  };

  if (isLoading) {
    return (
      <Card padding="none" className="animate-pulse">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4" />
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="lg" className="text-center">
        <p className="text-red-600">Failed to load alerts</p>
      </Card>
    );
  }

  const alerts = data?.data || [];
  const total = data?.meta.total || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="section-label mb-1">Triage queue · {total} open signals</p>
          <h1 className="page-title font-display">Alerts</h1>
          <p className="page-subtitle">Monitor and manage security alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={!alerts.length}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowRules(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Rules
          </Button>
        </div>
      </div>

      <Card padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search alerts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="input w-auto"
              aria-label="Filter by severity"
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFO">Info</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-auto"
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="FALSE_POSITIVE">False Positive</option>
            </select>
          </div>
        </div>
      </Card>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Alert</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Risk Score</th>
                <th>Source IP</th>
                <th>Rule</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id} className="threat-row" data-sev={alert.severity.toLowerCase()}>
                  <td>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{alert.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{alert.id}</p>
                    </div>
                  </td>
                  <td>
                    <Badge variant={alert.severity.toLowerCase() as any}>{alert.severity}</Badge>
                  </td>
                  <td>
                    <Badge variant={alert.status.toLowerCase().replace('_', '') as any}>{alert.status.replace('_', ' ')}</Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-xs">
                        <div
                          className="h-full bg-primary-600"
                          style={{ width: `${alert.riskScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-10">{alert.riskScore}</span>
                    </div>
                  </td>
                  <td>
                    <code className="text-sm font-mono text-gray-600 dark:text-gray-400">{alert.metadata?.sourceIp as string || 'unknown'}</code>
                  </td>
                  <td className="text-sm text-gray-600 dark:text-gray-400">{alert.rule?.name || 'Unknown'}</td>
                  <td className="text-sm text-gray-500 dark:text-gray-400">{new Date(alert.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleStatusChange(alert.id, 'ACKNOWLEDGED')}>
                        Acknowledge
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleStatusChange(alert.id, 'INVESTIGATING')}>
                        Investigate
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleStatusChange(alert.id, 'RESOLVED')}>
                        Resolve
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!alerts.length && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <p className="font-medium text-gray-900 dark:text-gray-100">No alerts match your filters</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Try widening the time window or clearing filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {total === 0 ? 0 : ((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} results
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {data?.meta.totalPages || 1}</span>
            <Button variant="ghost" size="sm" disabled={page >= (data?.meta.totalPages || 1)} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      <RulesManager open={showRules} onClose={() => setShowRules(false)} />
    </div>
  );
}

function RulesManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addToast } = useToast();
  const { user } = useAuthStore();
  const { data: rules, isLoading } = useDetectionRules();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const canManage = user?.role === 'ADMIN' || user?.role === 'ANALYST';
  const canDelete = user?.role === 'ADMIN';

  const [form, setForm] = useState({
    name: '',
    severity: 'HIGH' as (typeof SEVERITIES)[number],
    eventType: 'ssh_failed_login',
    threshold: 5,
    window: '5m' as (typeof WINDOWS)[number]['value'],
    groupBy: 'sourceIp' as (typeof GROUP_BYS)[number],
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createRule.mutate(
      {
        name: form.name.trim(),
        severity: form.severity,
        logic: {
          condition: 'AND',
          rules: [
            { field: 'eventType', operator: 'equals', value: form.eventType.trim() },
            { aggregation: 'count', operator: 'gte', value: Number(form.threshold), window: form.window, groupBy: form.groupBy },
          ],
        },
      },
      {
        onSuccess: () => {
          addToast({ type: 'success', title: 'Rule created', message: `"${form.name}" is now active.` });
          setForm({ name: '', severity: 'HIGH', eventType: 'ssh_failed_login', threshold: 5, window: '5m', groupBy: 'sourceIp' });
        },
        onError: (err: any) => addToast({
          type: 'error', title: 'Creation failed',
          message: err.response?.data?.message || 'Could not create rule.',
        }),
      }
    );
  };

  const handleToggle = (id: string, enabled: boolean) => {
    updateRule.mutate({ id, enabled: !enabled });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete rule "${name}"? Existing alerts are kept.`)) return;
    deleteRule.mutate(id, {
      onError: (err: any) => addToast({
        type: 'error', title: 'Delete failed',
        message: err.response?.data?.message || 'Could not delete rule.',
      }),
    });
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Detection Rules" size="lg">
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Active rules ({rules?.length ?? 0})
          </h4>
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 w-full" />)}</div>
          ) : !rules?.length ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No rules configured.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
              {rules.map((rule: any) => (
                <div key={rule.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{rule.name}</p>
                      <Badge variant={rule.severity.toLowerCase()}>{rule.severity}</Badge>
                      {!rule.enabled && <Badge variant="info">Disabled</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {(rule._count?.alerts ?? 0).toLocaleString()} alerts triggered
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => handleToggle(rule.id, rule.enabled)}>
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(rule.id, rule.name)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!canManage && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">View-only access — analysts and admins can manage rules.</p>
          )}
        </div>

        {canManage && (
          <form onSubmit={handleCreate} className="space-y-4 border-t border-gray-200 dark:border-gray-800 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New rule: alert when an event type repeats</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Input label="Rule name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., RDP Brute Force" required />
              </div>
              <div>
                <label className="label">Severity</label>
                <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as any })} className="input">
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Input label="At least (events)" type="number" min={2} max={1000} value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} required />
              <div className="col-span-2">
                <Input label="Event type" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} placeholder="ssh_failed_login" required />
              </div>
              <div>
                <label className="label">Within</label>
                <select value={form.window} onChange={(e) => setForm({ ...form, window: e.target.value as any })} className="input">
                  {WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Grouped by</label>
                <select value={form.groupBy} onChange={(e) => setForm({ ...form, groupBy: e.target.value as any })} className="input">
                  {GROUP_BYS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={createRule.isPending}>Create Rule</Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
