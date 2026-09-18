import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '@/store/uiStore';
import { useDashboardStats, useSystemStatus } from '@/api/hooks';
import { cn } from '@/utils/helpers';
import {
  LayoutDashboard,
  AlertTriangle,
  FileText,
  Activity,
  BarChart3,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useMemo, useState } from 'react';

const navGroups = [
  {
    label: 'Monitor',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Alerts', href: '/alerts', icon: AlertTriangle, badgeKey: 'openAlerts' as const },
      { name: 'Incidents', href: '/incidents', icon: FileText, badgeKey: 'openIncidents' as const },
    ],
  },
  {
    label: 'Telemetry',
    items: [
      { name: 'Events', href: '/events', icon: Activity },
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
      { name: 'Threat Intel', href: '/iocs', icon: Shield },
    ],
  },
  {
    label: 'System',
    items: [{ name: 'Settings', href: '/settings', icon: Settings }],
  },
];

function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now.toISOString().slice(11, 19) + ' UTC';
}

export function DashboardLayout() {
  const { sidebarOpen, toggleSidebar, setTheme } = useUIStore();
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: stats } = useDashboardStats();
  const { data: system } = useSystemStatus();
  const clock = useUtcClock();

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'light' : 'dark');
  };

  const currentPageName = useMemo(() => {
    for (const g of navGroups) {
      const found = g.items.find((n) => location.pathname.startsWith(n.href));
      if (found) return found.name;
    }
    return 'Dashboard';
  }, [location.pathname]);

  const navLinkClassName = (isActive: boolean) =>
    cn('nav-link', isActive && 'nav-link-active', !sidebarOpen && 'justify-center px-2');

  const sidebarClassName = cn(
    'fixed inset-y-0 left-0 z-40 bg-white/90 dark:bg-[#04081a]/90 backdrop-blur-xl border-r border-gray-200/80 dark:border-white/[0.07] shadow-card transition-all duration-300',
    sidebarOpen ? 'w-64' : 'w-20'
  );

  const contentClassName = cn('transition-all duration-300', sidebarOpen ? 'lg:pl-64' : 'lg:pl-20');
  const dbUp = system ? system.database === 'connected' : true;
  const mlUp = system ? system.mlService.status === 'healthy' || system.mlService.status === 'ok' : true;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-950">
      <aside className={sidebarClassName}>
        <div className="flex flex-col h-full">
          <div className={cn('flex items-center h-16 px-4 border-b border-gray-200/80 dark:border-white/[0.07]', sidebarOpen ? 'justify-between' : 'justify-center')}>
            <NavLink to="/dashboard" className="flex items-center gap-2.5" aria-label="CyberSentinel">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl text-white shadow-glow shrink-0" style={{ backgroundImage: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 50%, #22d3ee 100%)' }}>
                <Shield className="w-5 h-5" />
              </span>
              {sidebarOpen && (
                <span className="font-display text-lg font-bold tracking-tight text-gray-900 dark:text-white leading-none">
                  Cyber<span className="text-gradient">Sentinel</span>
                  <span className="block text-[10px] font-sans font-semibold tracking-[0.28em] text-gray-400 dark:text-gray-500 mt-1">SOC CONSOLE</span>
                </span>
              )}
            </NavLink>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className={cn(sidebarOpen ? '' : 'hidden')}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </Button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin" aria-label="Main navigation">
            {navGroups.map((group) => (
              <div key={group.label}>
                {sidebarOpen && (
                  <p className="section-label px-3 mb-1.5">{group.label}</p>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = location.pathname.startsWith(item.href);
                    const badgeCount =
                      'badgeKey' in item && item.badgeKey && stats ? (stats[item.badgeKey] as number) : 0;
                    return (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        className={navLinkClassName(isActive)}
                        title={sidebarOpen ? undefined : item.name}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                        {sidebarOpen && (
                          <>
                            <span className="flex-1 truncate">{item.name}</span>
                            {badgeCount > 0 && (
                              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-bold font-mono bg-cyan-500/10 text-cyan-700 rounded-md ring-1 ring-inset ring-cyan-500/25 dark:text-cyan-300">
                                {badgeCount > 99 ? '99+' : badgeCount}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-gray-200/80 dark:border-white/[0.07] space-y-3">
            {sidebarOpen ? (
              <>
                <div className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] ring-1 ring-inset ring-gray-200/60 dark:ring-white/[0.06] space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-gray-500 dark:text-gray-400">
                    <span className="live-dot"><span /><span /></span>
                    <span>GRID NOMINAL</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-gray-500 dark:text-gray-400">
                    <span>DB {dbUp ? '●' : '○'}</span>
                    <span>ML {mlUp ? '●' : '○'}</span>
                    <span className={cn(dbUp && mlUp ? 'text-emerald-500' : 'text-red-500')}>{clock}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-2">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0 ring-2 ring-cyan-500/30" style={{ backgroundImage: 'linear-gradient(135deg, #0369a1, #22d3ee)' }}>
                    {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {user?.firstName || user?.email}
                    </p>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-400">{user?.role?.toLowerCase()}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out" className="text-gray-400 hover:text-red-500">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ring-2 ring-cyan-500/30" style={{ backgroundImage: 'linear-gradient(135deg, #0369a1, #22d3ee)' }}>
                  {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                </div>
                <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out" className="text-gray-400 hover:text-red-500">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className={contentClassName}>
        <header className="sticky top-0 z-30 glass border-b border-gray-200/80 dark:border-white/[0.07] shadow-card">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={toggleSidebar} className="lg:hidden" aria-label="Toggle sidebar">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
              <div className="hidden sm:block">
                <h1 className="font-display text-lg font-bold tracking-tight text-gray-900 dark:text-white leading-tight">{currentPageName}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 font-mono">
                  <span className="live-dot" style={{ transform: 'scale(0.75)' }}><span /><span /></span>
                  LIVE · {clock}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle dark mode">
                <Sun className="w-5 h-5 hidden dark:block" />
                <Moon className="w-5 h-5 dark:hidden" />
              </Button>
              <Button variant="ghost" size="sm" className="relative" onClick={() => navigate('/alerts')} aria-label={`View open alerts (${stats?.openAlerts ?? 0})`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {(stats?.openAlerts ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-glow-critical">
                    {(stats?.openAlerts ?? 0) > 99 ? '99+' : stats?.openAlerts}
                  </span>
                )}
              </Button>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ring-2 ring-cyan-500/30" style={{ backgroundImage: 'linear-gradient(135deg, #0369a1, #22d3ee)' }}>
                {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 console-grid-bg min-h-[calc(100vh-4rem)]" aria-label="Main content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
