import { Card, CardHeader, Badge } from '@/components/ui';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { useDashboardStats, useTimeSeries, useDetectionRules } from '@/api/hooks';
import { useChartTheme } from '@/utils/helpers';

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  INFO: '#64748b',
};

function ChartTooltip({ active, payload, label, labelFormatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-900 px-3 py-2 shadow-card-hover text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-gray-600 dark:text-gray-300 tabular-nums">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: entry.color || entry.payload?.color || '#0ea5e9' }} />
          {entry.name}: <span className="font-semibold">{Number(entry.value).toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

function LoadingChart({ height = 'h-80' }: { height?: string }) {
  return (
    <div className={`${height}`}>
      <div className="skeleton h-full w-full" />
    </div>
  );
}

export function AnalyticsPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: eventsSeries, isLoading: eventsLoading } = useTimeSeries('events', '1h', 24);
  const { data: rules, isLoading: rulesLoading } = useDetectionRules();
  const chart = useChartTheme();

  if (statsError) {
    return (
      <Card padding="lg">
        <div className="empty-state">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Failed to load analytics</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Check that the backend API is reachable, then try again.</p>
        </div>
      </Card>
    );
  }

  const severityData = (stats?.severityDistribution || []).map((d) => ({
    name: d.severity.charAt(0) + d.severity.slice(1).toLowerCase(),
    value: d.count,
    color: SEVERITY_COLORS[d.severity] || '#64748b',
  }));

  const eventTypeData = (stats?.topEventTypes || []).map((d) => ({ type: d.type, count: d.count }));
  const sourceIpData = (stats?.topSourceIps || []).map((d) => ({ ip: d.ip, count: d.count }));
  const maxIp = Math.max(1, ...sourceIpData.map((d) => d.count));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="section-label mb-1">Trends & telemetry</p>
        <h1 className="page-title font-display">Analytics</h1>
        <p className="page-subtitle">Security metrics and trend analysis from live telemetry</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="md">
          <CardHeader title="Events Over Time" description="Ingested events per hour, last 24 hours" />
          {eventsLoading ? <LoadingChart /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={eventsSeries?.data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis
                    dataKey="timestamp" stroke={chart.tick} fontSize={11}
                    tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  />
                  <YAxis stroke={chart.tick} fontSize={11} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip labelFormatter={(l: string) => new Date(l).toLocaleString()} />} />
                  <Line type="monotone" dataKey="value" name="events" stroke="#0ea5e9" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card padding="md">
          <CardHeader title="Alerts by Severity" description="Alert distribution, last 24 hours" />
          {statsLoading ? <LoadingChart /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}
                    dataKey="value" nameKey="name"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="md">
          <CardHeader title="Top Event Types" description="Most frequent event categories, last 24 hours" />
          {statsLoading ? <LoadingChart /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventTypeData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
                <XAxis type="number" stroke={chart.tick} fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="type" stroke={chart.tick} fontSize={11} width={150} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.cursor }} />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card padding="md">
          <CardHeader title="Top Source IPs" description="Most active source addresses, last 24 hours" />
          {statsLoading ? <LoadingChart /> : !sourceIpData.length ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">No source IP data in this window.</p>
            </div>
          ) : (
            <div className="h-80 overflow-y-auto scrollbar-thin space-y-3.5 py-1">
              {sourceIpData.map((item) => (
                <div key={item.ip}>
                  <div className="flex items-center justify-between mb-1.5">
                    <code className="text-sm font-mono text-gray-900 dark:text-gray-100">{item.ip}</code>
                    <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">{item.count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bar-fill-cyan" style={{ width: `${(item.count / maxIp) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card padding="md">
        <CardHeader
          title="Detection Rules"
          description="Rules currently driving alert generation"
          action={<a href="/alerts" className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">Manage in Alerts →</a>}
        />
        {rulesLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 w-full" />)}
          </div>
        ) : !rules?.length ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No detection rules configured. Create one from the Alerts page.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(rules as any[]).map((rule) => (
              <div key={rule.id} className="p-4 rounded-xl bg-gray-50 dark:bg-white/5 ring-1 ring-inset ring-gray-200/60 dark:ring-white/5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{rule.name}</p>
                  <Badge variant={rule.enabled ? 'success' : 'info'}>{rule.enabled ? 'On' : 'Off'}</Badge>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{rule.description || 'No description'}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={rule.severity.toLowerCase()}>{rule.severity}</Badge>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{(rule._count?.alerts ?? 0).toLocaleString()} alerts</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
