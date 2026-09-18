import { Card, CardHeader, Button, Input, Badge, Modal } from '@/components/ui';
import { User, Shield, Bell, Key, Server, Database, Save, Copy, Check, Trash2, Plus, Loader2, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/components/ui';
import {
  useMe,
  useAIHealth,
  useSystemStatus,
  useUpdateProfile,
  useChangePassword,
  useEventSources,
  useCreateEventSource,
  useDeleteEventSource,
  useResetDemoData,
  useRunDemoAttack,
} from '@/api/hooks';
import { useAuthStore } from '@/store/authStore';
import { useUIStore, type NotificationKey } from '@/store/uiStore';
import { cn, formatRelativeTime } from '@/utils/helpers';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128, 'Password is too long'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type PasswordForm = z.infer<typeof passwordSchema>;

const SOURCE_TYPES = ['AGENT', 'SYSLOG', 'API', 'CLOUD', 'NETWORK'] as const;

const NOTIFICATION_META: Array<{ key: NotificationKey; label: string; desc: string }> = [
  { key: 'criticalAlerts', label: 'Critical Alerts', desc: 'Receive immediate notifications for critical severity alerts' },
  { key: 'highAlerts', label: 'High Severity Alerts', desc: 'Notify for high severity alerts' },
  { key: 'mediumDigest', label: 'Medium Severity Alerts', desc: 'Daily digest for medium severity alerts' },
  { key: 'incidentUpdates', label: 'Incident Updates', desc: 'Updates on assigned incidents' },
  { key: 'weeklyReports', label: 'Weekly Reports', desc: 'Weekly security posture summary' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'integrations' | 'system'>('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Server },
    { id: 'system', label: 'System', icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="section-label mb-1">Console preferences</p>
        <h1 className="page-title font-display">Settings</h1>
        <p className="page-subtitle">Manage your account and system preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1">
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'integrations' && <IntegrationsTab />}
          {activeTab === 'system' && <SystemTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { addToast } = useToast();
  const { data: userData, isLoading } = useMe();
  const updateProfile = useUpdateProfile();

  const [profile, setProfile] = useState({ firstName: '', lastName: '' });

  useEffect(() => {
    if (userData) {
      setProfile({ firstName: userData.firstName || '', lastName: userData.lastName || '' });
    }
  }, [userData]);

  const handleSave = () => {
    updateProfile.mutate(
      { firstName: profile.firstName.trim() || null, lastName: profile.lastName.trim() || null },
      {
        onSuccess: () => addToast({ type: 'success', title: 'Profile updated', message: 'Your profile has been saved.' }),
        onError: (err: any) => addToast({ type: 'error', title: 'Save failed', message: err.response?.data?.message || 'Failed to update profile.' }),
      }
    );
  };

  if (isLoading) {
    return (
      <Card padding="lg">
        <div className="skeleton h-6 w-1/3 mb-4" />
        <div className="skeleton h-10 w-full max-w-md mb-4" />
        <div className="skeleton h-10 w-full max-w-md" />
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <CardHeader title="Profile" description="Manage your personal information" />
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6 max-w-md">
        <div className="grid grid-cols-2 gap-4">
          <Input label="First Name" value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} autoComplete="given-name" />
          <Input label="Last Name" value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} autoComplete="family-name" />
        </div>
        <Input label="Email" value={userData?.email || ''} type="email" disabled helperText="Email addresses cannot be changed. Contact an administrator if needed." />
        <div>
          <span className="label">Role</span>
          <Badge variant="info">{userData?.role || '—'}</Badge>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Roles are assigned by an administrator.</p>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={updateProfile.isPending}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SecurityTab() {
  const { addToast } = useToast();
  const changePassword = useChangePassword();
  const { data: sources } = useEventSources();
  const { data: userData } = useMe();
  const createSource = useCreateEventSource();
  const deleteSource = useDeleteEventSource();

  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sourceForm, setSourceForm] = useState({ name: '', type: 'AGENT' as (typeof SOURCE_TYPES)[number], description: '' });

  const isAdmin = userData?.role === 'ADMIN';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onPasswordSubmit = (data: PasswordForm) => {
    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          addToast({ type: 'success', title: 'Password updated', message: 'Use your new password next time you sign in.' });
          reset();
        },
        onError: (err: any) => addToast({
          type: 'error',
          title: 'Update failed',
          message: err.response?.data?.message || 'Could not update password.',
        }),
      }
    );
  };

  const handleCreateSource = (e: React.FormEvent) => {
    e.preventDefault();
    setNewKey(null);
    setCopied(false);
    createSource.mutate(
      { name: sourceForm.name.trim(), type: sourceForm.type, description: sourceForm.description.trim() || undefined },
      {
        onSuccess: (res: any) => {
          setNewKey(res.data.apiKey);
          setSourceForm({ name: '', type: 'AGENT', description: '' });
        },
        onError: (err: any) => addToast({
          type: 'error',
          title: 'Creation failed',
          message: err.response?.data?.message || 'Could not create ingestion source.',
        }),
      }
    );
  };

  const handleDeleteSource = (id: string, name: string) => {
    if (!confirm(`Revoke ingestion source "${name}"? Agents using its API key will stop working.`)) return;
    deleteSource.mutate(id, {
      onSuccess: () => addToast({ type: 'success', title: 'Source revoked' }),
      onError: (err: any) => addToast({
        type: 'error',
        title: 'Revoke failed',
        message: err.response?.data?.message || 'Could not revoke source.',
      }),
    });
  };

  const copyKey = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast({ type: 'error', title: 'Copy failed', message: 'Select the key manually to copy it.' });
    }
  };

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <CardHeader title="Change Password" description="Update your password" />
        <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4 max-w-md">
          <Input label="Current Password" type="password" placeholder="••••••••" error={errors.currentPassword?.message} autoComplete="current-password" {...register('currentPassword')} />
          <Input label="New Password" type="password" placeholder="••••••••" error={errors.newPassword?.message} autoComplete="new-password" {...register('newPassword')} />
          <Input label="Confirm New Password" type="password" placeholder="••••••••" error={errors.confirmPassword?.message} autoComplete="new-password" {...register('confirmPassword')} />
          <Button type="submit" loading={changePassword.isPending}>
            {changePassword.isPending && <Loader2 className="w-4 h-4 mr-2" />}
            Update Password
          </Button>
        </form>
      </Card>

      <Card padding="lg">
        <CardHeader
          title="Ingestion API Keys"
          description="API keys authenticate event sources sending telemetry. Keys are shown once at creation."
          action={isAdmin ? <Button variant="secondary" size="sm" onClick={() => { setNewKey(null); setShowModal(true); }}><Plus className="w-4 h-4 mr-2" />Generate New Key</Button> : undefined}
        />
        {!sources?.length ? (
          <div className="empty-state">
            <p className="font-medium text-gray-900 dark:text-gray-100">No ingestion sources yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isAdmin ? 'Generate a key to connect your first event source.' : 'An administrator can generate ingestion keys.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{s.name}</p>
                    <Badge variant={s.isActive ? 'success' : 'info'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                    <Badge variant="info">{s.type}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {(s._count?.events ?? 0).toLocaleString()} events
                    {s.lastSeenAt ? ` • Last seen ${formatRelativeTime(s.lastSeenAt)}` : ' • Never seen'}
                    {' • '}Created {formatRelativeTime(s.createdAt)}
                  </p>
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0" onClick={() => handleDeleteSource(s.id, s.name)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Revoke
                  </Button>
                )}
              </div>
            ))}
            {!isAdmin && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Only administrators can generate or revoke keys.</p>
            )}
          </div>
        )}
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Generate Ingestion Key" size="md">
        {newKey ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Copy this key now — it will never be shown again.</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 font-mono text-sm bg-gray-50 dark:bg-gray-800 rounded-lg break-all">{newKey}</code>
              <Button variant="secondary" size="sm" onClick={copyKey}>
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowModal(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateSource} className="space-y-4">
            <Input label="Source Name" value={sourceForm.name} onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })} placeholder="e.g., DMZ Web Server" required />
            <div>
              <label className="label">Type</label>
              <select value={sourceForm.type} onChange={(e) => setSourceForm({ ...sourceForm, type: e.target.value as any })} className="input">
                {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Input label="Description" value={sourceForm.description} onChange={(e) => setSourceForm({ ...sourceForm, description: e.target.value })} placeholder="Where does this telemetry come from?" />
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" loading={createSource.isPending}><Key className="w-4 h-4 mr-2" />Generate Key</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function NotificationsTab() {
  const prefs = useUIStore((s) => s.notificationPrefs);
  const setPref = useUIStore((s) => s.setNotificationPref);

  return (
    <Card padding="lg">
      <CardHeader title="Notification Preferences" description="Stored on this device. Configure how you receive alerts" />
      <div className="space-y-4">
        {NOTIFICATION_META.map((item) => (
          <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!prefs[item.key]}
                onChange={(e) => setPref(item.key, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>
        ))}
      </div>
    </Card>
  );
}

function IntegrationsTab() {
  const { data: status, isLoading: statusLoading } = useSystemStatus();
  const { data: aiHealth } = useAIHealth();

  const mlHealthy = status?.mlService.status === 'healthy' || status?.mlService.status === 'ok';
  const mlLoaded = !!status?.mlService.modelLoaded;

  return (
    <div className="space-y-4">
      <Card padding="lg">
        <CardHeader title="ML Service" description="Machine learning anomaly detection service" />
        {statusLoading ? (
          <div className="skeleton h-6 w-1/2" />
        ) : !status ? (
          <p className="text-sm text-red-600">Could not reach the backend status endpoint.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('w-3 h-3 rounded-full', mlHealthy ? 'bg-green-500' : 'bg-red-500')} />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {mlHealthy ? 'Connected' : 'Unreachable'}
                </span>
              </div>
              <Badge variant={mlHealthy ? 'success' : 'critical'}>{mlHealthy ? 'Healthy' : 'Down'}</Badge>
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex gap-2"><dt className="text-gray-500 dark:text-gray-400">Endpoint:</dt><dd className="font-mono text-gray-900 dark:text-gray-100">{status.mlService.endpoint}</dd></div>
              <div className="flex gap-2"><dt className="text-gray-500 dark:text-gray-400">Version:</dt><dd className="font-mono text-gray-900 dark:text-gray-100">{status.mlService.version}</dd></div>
              <div className="flex gap-2"><dt className="text-gray-500 dark:text-gray-400">Model:</dt><dd className="font-mono text-gray-900 dark:text-gray-100">{mlLoaded ? 'Loaded' : 'Not loaded'}</dd></div>
            </dl>
          </>
        )}
      </Card>

      <Card padding="lg">
        <CardHeader title="AI Provider" description="AI-powered investigation assistant" />
        {!aiHealth ? (
          <div className="skeleton h-16 w-full" />
        ) : (
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                {aiHealth.provider === 'none' ? 'Built-in analysis (no external provider)' : aiHealth.provider}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {aiHealth.healthy ? 'Reachable' : 'Unreachable'}
              </p>
            </div>
            <Badge variant={aiHealth.healthy ? 'success' : 'critical'}>{aiHealth.healthy ? 'Healthy' : 'Down'}</Badge>
          </div>
        )}
      </Card>
    </div>
  );
}

function SystemTab() {
  const { data: status, isLoading, error } = useSystemStatus();

  if (isLoading) {
    return (
      <Card padding="lg">
        <div className="skeleton h-6 w-1/3 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
        </div>
      </Card>
    );
  }

  if (error || !status) {
    return (
      <Card padding="lg">
        <CardHeader title="System Information" description="Platform version and status" />
        <p className="text-sm text-red-600">Could not load live system status.</p>
      </Card>
    );
  }

  const rows: Array<{ label: string; value: string; badge?: { text: string; variant: 'success' | 'critical' } }> = [
    { label: 'Version', value: status.version },
    { label: 'Environment', value: status.environment },
    {
      label: 'Database',
      value: status.database === 'connected' ? 'PostgreSQL • Connected' : 'PostgreSQL • Disconnected',
      badge: status.database === 'connected' ? { text: 'Up', variant: 'success' } : { text: 'Down', variant: 'critical' },
    },
    {
      label: 'ML Service',
      value: `${status.mlService.endpoint} • v${status.mlService.version}`,
      badge: status.mlService.status === 'healthy' || status.mlService.status === 'ok'
        ? { text: 'Up', variant: 'success' }
        : { text: 'Down', variant: 'critical' },
    },
  ];

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <CardHeader title="System Information" description="Live platform version and status" />
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((row) => (
            <div key={row.label} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <dt className="text-sm text-gray-500 dark:text-gray-400">{row.label}</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span className="font-mono text-gray-900 dark:text-gray-100">{row.value}</span>
                {row.badge && <Badge variant={row.badge.variant}>{row.badge.text}</Badge>}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      <DangerZone />
    </div>
  );
}

function DangerZone() {
  const { addToast } = useToast();
  const { user } = useAuthStore();
  const resetData = useResetDemoData();
  const runDemo = useRunDemoAttack();
  const [confirmingReset, setConfirmingReset] = useState(false);

  if (user?.role !== 'ADMIN') return null;

  const handleReset = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      setTimeout(() => setConfirmingReset(false), 5000);
      return;
    }
    setConfirmingReset(false);
    resetData.mutate(undefined, {
      onSuccess: (res) => {
        const total = Object.values(res.deleted).reduce((a: number, b: number) => a + b, 0);
        addToast({ type: 'success', title: 'Demo data cleared', message: `${total} records removed. Dashboard should read zero everywhere.` });
      },
      onError: (err: any) => addToast({
        type: 'error', title: 'Reset failed',
        message: err.response?.data?.message || 'Could not reset demo data.',
      }),
    });
  };

  const handleDemo = () => {
    runDemo.mutate(undefined, {
      onSuccess: (res) => addToast({
        type: 'success', title: 'Demo attack complete',
        message: `${res.ingested} events in, ${res.alertsCreated} alerts, ${res.incidentsCreated} incidents.`,
      }),
      onError: (err: any) => addToast({
        type: 'error', title: 'Demo attack failed',
        message: err.response?.data?.message || 'Could not run the demo attack.',
      }),
    });
  };

  return (
    <Card padding="lg">
      <CardHeader
        title="Demo Controls"
        description="Reset all telemetry to zero, then run a live-fire attack and watch every number move. Admin only."
      />
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="danger"
          onClick={handleReset}
          loading={resetData.isPending}
          className={cn(!confirmingReset && 'opacity-90')}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {confirmingReset ? 'Click again to confirm wipe' : 'Reset All Data to Zero'}
        </Button>
        <Button variant="secondary" onClick={handleDemo} loading={runDemo.isPending}>
          <Zap className="w-4 h-4 mr-2" />
          Run Demo Attack
        </Button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
        Reset deletes events, alerts, incidents and their links (users, rules, sources and audit logs are kept).
        The demo attack runs 6 scenarios through the real pipeline and auto-groups the alerts.
      </p>
    </Card>
  );
}
