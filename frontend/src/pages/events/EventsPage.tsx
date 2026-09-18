import { useState } from 'react';
import { Card, Badge, Button, Input, Modal } from '@/components/ui';
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEvents, useEventSources, useEvent } from '@/api/hooks';
import { downloadCsv } from '@/utils/csv';
import type { Event } from '@/types/api';

type EventDetail = Event & {
  alerts?: Array<{ alert: { id: string; title: string; severity: string; riskScore: number } }>;
  mlPredictions?: Array<{ anomalyScore: number; modelVersion: string }>;
  iocMatches?: Array<{ ioc: { type: string; value: string; confidence: number } }>;
};

export function EventsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [sourceIdFilter, setSourceIdFilter] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, error } = useEvents({
    page,
    limit: 50,
    search: search || undefined,
    eventType: eventTypeFilter || undefined,
    severity: severityFilter || undefined,
    sourceId: sourceIdFilter || undefined,
  });

  const { data: sources } = useEventSources();

  const handleExport = () => {
    const rows = (data?.data || []).map((e) => [
      e.id, e.timestamp, e.eventType, e.severity,
      e.sourceIp || '', e.destIp || '', e.username || '',
      JSON.stringify(e.metadata ?? {}),
    ]);
    downloadCsv(
      `events-page${page}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['id', 'timestamp', 'eventType', 'severity', 'sourceIp', 'destIp', 'username', 'metadata'],
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
        <p className="text-red-600">Failed to load events</p>
      </Card>
    );
  }

  const events = data?.data || [];
  const total = data?.meta.total || 0;
  const availableEventTypes = [...new Set(events.map(e => e.eventType))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="section-label mb-1">Raw telemetry · {total.toLocaleString()} in view</p>
          <h1 className="page-title font-display">Events</h1>
          <p className="page-subtitle">Browse and search raw security events</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleExport} disabled={!events.length}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input placeholder="Search events (IP, user, type)..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="input w-auto min-w-[180px]"
              aria-label="Filter by event type"
            >
              <option value="">All Event Types</option>
              {availableEventTypes.map(type => <option key={type} value={type}>{type}</option>)}
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
            <select
              value={sourceIdFilter}
              onChange={(e) => setSourceIdFilter(e.target.value)}
              className="input w-auto min-w-[180px]"
              aria-label="Filter by source"
            >
              <option value="">All Sources</option>
              {sources?.map((s: { id: string; name: string }) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Source IP</th>
                <th>Dest IP</th>
                <th>User</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((event) => (
                <tr key={event.id} className="threat-row" data-sev={event.severity.toLowerCase()}>
                  <td className="text-sm text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">{new Date(event.timestamp).toLocaleString()}</td>
                  <td className="text-sm font-mono text-gray-900 dark:text-gray-100">{event.eventType}</td>
                  <td><Badge variant={event.severity.toLowerCase() as any}>{event.severity}</Badge></td>
                  <td><code className="text-sm font-mono text-gray-600 dark:text-gray-400">{event.sourceIp || '-'}</code></td>
                  <td><code className="text-sm font-mono text-gray-600 dark:text-gray-400">{event.destIp || '-'}</code></td>
                  <td className="text-sm text-gray-600 dark:text-gray-400">{event.username || '-'}</td>
                  <td><Button variant="ghost" size="sm" onClick={() => setDetailId(event.id)}>Details</Button></td>
                </tr>
              ))}
              {!data?.data.length && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <p className="font-medium text-gray-900 dark:text-gray-100">No events match your filters</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Try widening the search or clearing filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {total === 0 ? 0 : ((page - 1) * 50) + 1} to {Math.min(page * 50, total)} of {total} results
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

      <EventDetailsModal eventId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function EventDetailsModal({ eventId, onClose }: { eventId: string | null; onClose: () => void }) {
  const { data: event, isLoading } = useEvent(eventId || '');

  return (
    <Modal isOpen={!!eventId} onClose={onClose} title="Event Details" size="lg">
      {isLoading || !event ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
        </div>
      ) : (
        <EventDetailsBody event={event as EventDetail} />
      )}
    </Modal>
  );
}

function EventDetailsBody({ event }: { event: EventDetail }) {
  const fields: Array<[string, string]> = [
    ['ID', event.id],
    ['Timestamp', new Date(event.timestamp).toLocaleString()],
    ['Type', event.eventType],
    ['Severity', event.severity],
    ['Source IP', event.sourceIp || '—'],
    ['Destination IP', event.destIp || '—'],
    ['Username', event.username || '—'],
    ['Source', event.source?.name || event.sourceId],
  ];

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(([label, value]) => (
          <div key={label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="mt-1 text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Linked Alerts ({event.alerts?.length || 0})
        </h4>
        {!event.alerts?.length ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No alerts were generated from this event.</p>
        ) : (
          <div className="space-y-2">
            {event.alerts.map(({ alert }) => (
              <div key={alert.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{alert.title}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={alert.severity.toLowerCase() as any}>{alert.severity}</Badge>
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">risk {alert.riskScore}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">ML Anomaly</h4>
          {!event.mlPredictions?.length ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No prediction recorded.</p>
          ) : (
            event.mlPredictions.map((p, i) => (
              <p key={i} className="text-sm text-gray-600 dark:text-gray-300">
                Score <span className="font-mono font-semibold">{p.anomalyScore.toFixed(3)}</span>
                <span className="text-gray-400"> • {p.modelVersion}</span>
              </p>
            ))
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            IOC Matches ({event.iocMatches?.length || 0})
          </h4>
          {!event.iocMatches?.length ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No threat intel hits.</p>
          ) : (
            <div className="space-y-1.5">
              {event.iocMatches.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant="info">{m.ioc.type}</Badge>
                  <code className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">{m.ioc.value}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Raw Metadata</h4>
        <pre className="p-3 rounded-lg bg-gray-950 text-gray-100 text-xs font-mono overflow-x-auto scrollbar-thin max-h-48 overflow-y-auto">
          {JSON.stringify(event.metadata ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
