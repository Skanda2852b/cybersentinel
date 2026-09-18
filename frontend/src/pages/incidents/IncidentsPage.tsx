import { useState } from 'react';
import { Card, Badge, Button, Input, Modal, useToast } from '@/components/ui';
import { Search, Plus, Wand2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useIncidents,
  useUpdateIncident,
  useCreateIncident,
  useAutoGroupAlerts,
  useAlerts,
} from '@/api/hooks';
import { useAuthStore } from '@/store/authStore';
import type { Incident } from '@/types/api';

export function IncidentsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading, error } = useIncidents({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
  });

  const updateIncident = useUpdateIncident();
  const autoGroup = useAutoGroupAlerts();
  const { addToast } = useToast();
  const { user } = useAuthStore();
  const canManage = user?.role === 'ADMIN' || user?.role === 'ANALYST';

  const handleStatusChange = (incidentId: string, status: Incident['status']) => {
    updateIncident.mutate({ id: incidentId, status });
  };

  const handleAutoGroup = () => {
    autoGroup.mutate(undefined, {
      onSuccess: (res: any) => addToast({
        type: 'success',
        title: 'Auto-group complete',
        message: res.created === 1 ? '1 incident created from open alerts.' : `${res.created} incidents created from open alerts.`,
      }),
      onError: (err: any) => addToast({
        type: 'error', title: 'Auto-group failed',
        message: err.response?.data?.message || 'Could not auto-group alerts.',
      }),
    });
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
        <p className="text-red-600">Failed to load incidents</p>
      </Card>
    );
  }

  const total = data?.meta.total || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="section-label mb-1">Case management · {total} in view</p>
          <h1 className="page-title font-display">Incidents</h1>
          <p className="page-subtitle">Track and manage security incidents</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleAutoGroup} loading={autoGroup.isPending}>
              <Wand2 className="w-4 h-4 mr-2" />
              Auto-group Alerts
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Incident
            </Button>
          </div>
        )}
      </div>

      <Card padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input placeholder="Search incidents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-auto"
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="CONTAINED">Contained</option>
              <option value="ERADICATED">Eradicated</option>
              <option value="RECOVERED">Recovered</option>
              <option value="CLOSED">Closed</option>
            </select>
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
          </div>
        </div>
      </Card>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Risk Score</th>
                <th>Assigned To</th>
                <th>Alerts</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((incident) => (
                <tr key={incident.id} className="threat-row" data-sev={incident.severity.toLowerCase()}>
                  <td>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{incident.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{incident.id}</p>
                    </div>
                  </td>
                  <td><Badge variant={incident.severity.toLowerCase() as any}>{incident.severity}</Badge></td>
                  <td><Badge variant={incident.status.toLowerCase() as any}>{incident.status}</Badge></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-xs">
                        <div className="h-full bg-primary-600" style={{ width: `${incident.riskScore}%` }} />
                      </div>
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-10">{incident.riskScore}</span>
                    </div>
                  </td>
                  <td className="text-sm text-gray-600 dark:text-gray-400">{incident.assignedUser?.email || 'Unassigned'}</td>
                  <td className="text-sm font-medium text-gray-900 dark:text-gray-100">{incident.alerts?.length || 0}</td>
                  <td className="text-sm text-gray-500 dark:text-gray-400">{new Date(incident.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleStatusChange(incident.id, 'INVESTIGATING')}>
                        Investigate
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleStatusChange(incident.id, 'CONTAINED')}>
                        Contain
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleStatusChange(incident.id, 'CLOSED')}>
                        Close
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data?.data.length && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <p className="font-medium text-gray-900 dark:text-gray-100">No incidents yet</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create one from open alerts or run auto-group.</p>
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

      <NewIncidentModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}

function NewIncidentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addToast } = useToast();
  const createIncident = useCreateIncident();
  const { data: openAlerts, isLoading } = useAlerts({ status: 'OPEN', limit: 50 });

  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Incident['severity']>('HIGH');
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected.length) {
      addToast({ type: 'warning', title: 'No alerts selected', message: 'Select at least one alert to group.' });
      return;
    }
    createIncident.mutate(
      { title: title.trim(), severity, alertIds: selected },
      {
        onSuccess: () => {
          addToast({ type: 'success', title: 'Incident created' });
          setTitle('');
          setSelected([]);
          onClose();
        },
        onError: (err: any) => addToast({
          type: 'error', title: 'Creation failed',
          message: err.response?.data?.message || 'Could not create incident.',
        }),
      }
    );
  };

  const list = openAlerts?.data || [];

  return (
    <Modal isOpen={open} onClose={onClose} title="New Incident" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., SSH Brute Force Campaign" required />
        <div>
          <label className="label">Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as any)} className="input">
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="INFO">Info</option>
          </select>
        </div>
        <div>
          <span className="label">Alerts to group ({selected.length} selected)</span>
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}</div>
          ) : !list.length ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No open alerts right now.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
              {list.map((alert) => (
                <label key={alert.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:ring-1 hover:ring-primary-500/40">
                  <input
                    type="checkbox"
                    checked={selected.includes(alert.id)}
                    onChange={() => toggle(alert.id)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{alert.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{alert.severity} • risk {alert.riskScore} • {new Date(alert.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge variant={alert.severity.toLowerCase() as any}>{alert.severity}</Badge>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createIncident.isPending} disabled={!title.trim() || !selected.length}>
            Create Incident
          </Button>
        </div>
      </form>
    </Modal>
  );
}
