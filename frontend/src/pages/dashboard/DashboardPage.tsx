import { Card, CardHeader, Button, Badge, useToast } from '@/components/ui';
import { cn } from '@/utils/helpers';
import {
  AlertTriangle,
  FileText,
  Activity,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Radio,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useDashboardStats, useTimeSeries, useRunDemoAttack, useAlerts } from '@/api/hooks';
import { useAuthStore } from '@/store/authStore';
import type { DashboardStats } from '@/types/api';

const statCards = [
  { name: 'Total Events', key: 'totalEvents', icon: Activity, tile: 'linear-gradient(135deg, #0284c7, #22d3ee)' },
  { name: 'Total Alerts', key: 'totalAlerts', icon: AlertTriangle, tile: 'linear-gradient(135deg, #ea580c, #fbbf24)' },
  { name: 'Open Alerts', key: 'openAlerts', icon: AlertTriangle, tile: 'linear-gradient(135deg, #dc2626, #fb7185)' },
  { name: 'Total Incidents', key: 'totalIncidents', icon: FileText, tile: 'linear-gradient(135deg, #7c3aed, #c084fc)' },
  { name: 'Open Incidents', key: 'openIncidents', icon: FileText, tile: 'linear-gradient(135deg, #4f46e5, #818cf8)' },
  { name: 'Critical Alerts', key: 'criticalAlerts', icon: Shield, tile: 'linear-gradient(135deg, #991b1b, #ef4444)' },
] as const;

function ThreatHero({ stats }: { stats: DashboardStats | undefined }) {
  const critical = stats?.criticalAlerts ?? 0;
  const open = stats?.openAlerts ?? 0;
  const level =
    critical > 0 ? { name: 'SEVERE', blurb: `${critical} critical alert${critical === 1 ? '' : 's'} need${critical === 1 ? 's' : ''} immediate triage.`, ring: 'ring-red-500/40', text: 'text-red-500 dark:text-red-400', dot: 'bg-red-500' }
    : open > 0 ? { name: 'ELEVATED', blurb: `${open} open alert${open === 1 ? '' : 's'} awaiting triage.`, ring: 'ring-orange-500/40', text: 'text-orange-500 dark:text-orange-400', dot: 'bg-orange-500' }
    : { name: 'GUARDED', blurb: 'No open alerts. Sensors nominal, detection grid active.', ring: 'ring-emerald-500/40', text: 'text-emerald-500 dark:text-emerald-400', dot: 'bg-emerald-500' };

  return (
    <div className={cn('card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 ring-1 ring-inset', level.ring)}>
      <div className="flex items-center gap-4 min-w-0">
        <span className="relative flex h-12 w-12 shrink-0">
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-2xl opacity-25', level.dot)}></span>
          <span className={cn('relative inline-flex items-center justify-center rounded-2xl h-12 w-12 text-white', level.dot)}>
            <Shield className="w-6 h-6" />
          </span>
        </span>
        <div className="min-w-0">
          <p className="section-label">Current threat level</p>
          <p className={cn('font-display text-3xl font-bold tracking-tight', level.text)}>{level.name}</p>
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 sm:ml-2 sm:border-l sm:border-gray-200 sm:dark:border-white/10 sm:pl-4">
        {level.blurb}
      </p>
      <Link to="/alerts" className="btn-secondary btn sm:ml-auto shrink-0">
        Open alert queue <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function Sparkline({ data, stroke }: { data: Array<{ value: number }>; stroke: string }) {
  if (!data.length) return <div className="h-10 w-28" />;
  return (
    <div className="h-10 w-28 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={`spark-${stroke.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={stroke} strokeWidth={1.75} fill={`url(#spark-${stroke.replace('#', '')})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ name, value, icon: Icon, tile, trend, spark, sparkStroke }: { name: string; value: number; icon: React.ComponentType<{ className?: string }>; tile: string; trend: string; spark?: Array<{ value: number }>; sparkStroke?: string }) {
  const trendColor = trend.startsWith('+') ? 'text-green-600 dark:text-green-400' : trend.startsWith('-') ? 'text-red-600 dark:text-red-400' : 'text-gray-500';
  const TrendIcon = trend.startsWith('+') ? TrendingUp : trend.startsWith('-') ? TrendingDown : Minus;

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{name}</p>
          <p className="kpi-num mt-1.5">{value.toLocaleString()}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full', trend.startsWith('+') ? 'bg-green-500/10' : trend.startsWith('-') ? 'bg-red-500/10' : 'bg-gray-500/10')}>
              <TrendIcon className={cn('w-3 h-3', trendColor)} />
            </span>
            <span className={cn('text-sm font-semibold tabular-nums', trendColor)}>{trend}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">vs last period</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="p-2.5 rounded-xl text-white shadow-md" style={{ backgroundImage: tile }}>
            <Icon className="w-5 h-5" />
          </div>
          {spark && sparkStroke && <Sparkline data={spark} stroke={sparkStroke} />}
        </div>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, labelFormatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-900 px-3 py-2 shadow-card-hover text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-gray-600 dark:text-gray-300 tabular-nums">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: entry.color || entry.stroke || '#0ea5e9' }} />
          {entry.name}: <span className="font-semibold">{Number(entry.value).toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

function SeverityDistributionChart({ data }: { data: Array<{ severity: string; count: number }> }) {
  return (
    <Card padding="md">
      <CardHeader title="Severity Distribution" description="Alert counts by severity level" />
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="severity" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip
              content={<ChartTooltip labelFormatter={(label: string) => `Severity: ${label}`} />}
            />
            <Line 
              type="monotone" 
              dataKey="count" 
              stroke="#0ea5e9" 
              strokeWidth={2} 
              dot={{ fill: '#0ea5e9', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function EventsTimeSeriesChart({ data }: { data: Array<{ timestamp: string; value: number }> }) {
  return (
    <Card padding="md">
      <CardHeader title="Events (Last 24h)" description="Ingested event volume over time" />
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="timestamp" stroke="#64748b" fontSize={11} tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Tooltip
              content={<ChartTooltip labelFormatter={(label: string) => new Date(label).toLocaleString()} />}
            />
            <Area type="monotone" dataKey="value" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorEvents)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function TopSourceIPs({ data }: { data: Array<{ ip: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <Card padding="none">
      <div className="px-6 pt-5">
        <CardHeader title="Top Source IPs" description="Most active source addresses in the selected window" action={<a href="/events" className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">View all →</a>} />
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>IP Address</th>
              <th className="w-40">Event Count</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i}>
                <td className="font-mono text-gray-900 dark:text-gray-100">{item.ip}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(item.count / max) * 100}%`, backgroundImage: 'linear-gradient(90deg, #0284c7, #22d3ee)' }} />
                    </div>
                    <span className="text-sm tabular-nums text-gray-600 dark:text-gray-300 w-16 text-right">{item.count.toLocaleString()}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LiveAlertFeed() {
  const { data, isLoading } = useAlerts({ limit: 6 });
  const alerts = data?.data || [];

  return (
    <Card padding="md">
      <CardHeader
        title="Live Alert Feed"
        description="Latest detections across all rules"
        action={<Link to="/alerts" className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">Queue →</Link>}
      />
      {isLoading ? (
        <div className="space-y-2.5">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 w-full" />)}</div>
      ) : !alerts.length ? (
        <div className="empty-state !py-8">
          <Radio className="w-6 h-6 text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">All quiet — no recent alerts</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Link
              key={alert.id}
              to="/alerts"
              className="threat-row flex items-center gap-3 p-3 rounded-xl bg-gray-50/80 dark:bg-white/[0.03] ring-1 ring-inset ring-gray-200/50 dark:ring-white/[0.06] hover:ring-cyan-500/40 transition-all"
              data-sev={alert.severity.toLowerCase()}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{alert.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                  {alert.rule?.name || 'Unknown rule'} · {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <Badge variant={alert.severity.toLowerCase() as any}>{alert.severity}</Badge>
              <span className="text-sm font-mono font-bold tabular-nums text-gray-700 dark:text-gray-200 w-8 text-right">{alert.riskScore}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function TopEventTypes({ data }: { data: Array<{ type: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <Card padding="md">
      <CardHeader title="Top Event Types" description="Most frequent event categories" action={<a href="/events" className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">View all →</a>} />
      <div className="space-y-3.5">
        {data.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">{item.type}</span>
              <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">{item.count.toLocaleString()}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(item.count / max) * 100}%`, backgroundImage: 'linear-gradient(90deg, #7c3aed, #c084fc)' }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats();
  const { data: eventsTimeSeries } = useTimeSeries('events', '1h', 24);
  const { data: alertsTimeSeries } = useTimeSeries('alerts', '1h', 24);
  const { addToast } = useToast();
  const { user } = useAuthStore();
  const runDemo = useRunDemoAttack();
  const isAdmin = user?.role === 'ADMIN';

  const handleSimulate = () => {
    runDemo.mutate(undefined, {
      onSuccess: (res) => addToast({
        type: 'success',
        title: 'Demo attack complete',
        message: `${res.ingested} events in, ${res.alertsCreated} alerts, ${res.incidentsCreated} incidents, ${res.iocMatches} IOC hits.`,
      }),
      onError: (err: any) => addToast({
        type: 'error', title: 'Demo attack failed',
        message: err.response?.data?.message || 'Could not run the demo attack.',
      }),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-3 w-2/3 mb-3" />
              <div className="skeleton h-8 w-1/2 mb-3" />
              <div className="skeleton h-3 w-1/3" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-6"><div className="skeleton h-64 w-full" /></div>
          <div className="card p-6"><div className="skeleton h-64 w-full" /></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-10">
        <div className="empty-state">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">Failed to load dashboard data</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Check that the backend API is reachable, then try again.</p>
        </div>
      </div>
    );
  }

  const sparkFor = (key: string) => {
    if (key === 'totalEvents') return { data: eventsTimeSeries?.data || [], stroke: '#0ea5e9' };
    if (key === 'totalAlerts') return { data: alertsTimeSeries?.data || [], stroke: '#f97316' };
    return undefined;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {!isLoading && !error && <ThreatHero stats={stats} />}
      {isAdmin && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-primary-500/5 ring-1 ring-inset ring-primary-500/20 dark:bg-primary-500/10">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Live-fire test</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Run 6 canned attack scenarios through the real pipeline and watch every number move.</p>
          </div>
          <Button onClick={handleSimulate} loading={runDemo.isPending} className="shrink-0">
            <Zap className="w-4 h-4 mr-2" />
            Simulate Attack
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 stagger">
        {statCards.map((card) => {
          const spark = sparkFor(card.key);
          return (
            <StatCard
              key={card.key}
              name={card.name}
              value={(stats?.[card.key as keyof DashboardStats] as number) || 0}
              icon={card.icon}
              tile={card.tile}
              trend={stats?.trends?.[card.key as keyof DashboardStats['trends']] ?? '—'}
              spark={spark?.data}
              sparkStroke={spark?.stroke}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EventsTimeSeriesChart data={eventsTimeSeries?.data || []} />
        </div>
        <LiveAlertFeed />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopSourceIPs data={stats?.topSourceIps || []} />
        <TopEventTypes data={stats?.topEventTypes || []} />
        <SeverityDistributionChart data={stats?.severityDistribution || []} />
      </div>
    </div>
  );
}