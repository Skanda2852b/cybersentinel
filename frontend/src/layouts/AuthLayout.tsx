import { Outlet } from 'react-router-dom';
import { Shield, Radar, Zap, Eye } from 'lucide-react';

const pulses = [
  { top: '22%', left: '30%', delay: '0s', label: ' brute-force blocked' },
  { top: '58%', left: '62%', delay: '1.2s', label: 'C2 beacon flagged' },
  { top: '40%', left: '74%', delay: '2.1s', label: 'port scan detected' },
];

export function AuthLayout() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gray-50 dark:bg-dark-950">
      {/* Visual panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#020617] text-white p-12">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -right-24 w-[30rem] h-[30rem] rounded-full bg-violet-500/10 blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl text-white shadow-glow brand-bg">
            <Shield className="w-5 h-5" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Cyber<span className="text-gradient">Sentinel</span>
          </span>
        </div>

        {/* Radar */}
        <div className="relative mx-auto w-80 h-80" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border border-cyan-400/15" />
          <div className="absolute inset-8 rounded-full border border-cyan-400/20" />
          <div className="absolute inset-16 rounded-full border border-cyan-400/25" />
          <div className="absolute inset-24 rounded-full border border-cyan-400/30" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-300 shadow-glow" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-cyan-400/40 animate-ping" style={{ animationDuration: '2.4s' }} />
          {pulses.map((p, i) => (
            <span key={i} className="absolute w-2.5 h-2.5 -ml-1 -mt-1 rounded-full bg-red-400 animate-blink-soft" style={{ top: p.top, left: p.left, animationDelay: p.delay, boxShadow: '0 0 12px rgb(248 113 113 / 0.9)' }} />
          ))}
        </div>

        <div className="relative space-y-5">
          <p className="font-display text-3xl font-bold leading-tight tracking-tight">
            Every packet tells a story.<br />
            <span className="text-gradient">We read them all.</span>
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            {[
              { icon: Radar, title: 'Live detection', sub: 'Rules + ML, 24/7' },
              { icon: Zap, title: 'Instant triage', sub: 'Risk-scored alerts' },
              { icon: Eye, title: 'Full context', sub: 'Events to incidents' },
            ].map((f) => (
              <div key={f.title} className="rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/10 p-3 backdrop-blur">
                <f.icon className="w-4 h-4 text-cyan-300 mb-2" />
                <p className="text-xs font-semibold">{f.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{f.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center p-6 sm:p-10 overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-24 right-0 w-[26rem] h-[20rem] rounded-full bg-cyan-500/10 dark:bg-cyan-400/10 blur-3xl" />
        </div>
        <div className="w-full max-w-md relative animate-slide-up">
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl text-white shadow-glow brand-bg">
              <Shield className="w-5 h-5" />
            </span>
            <span className="font-display text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Cyber<span className="text-gradient">Sentinel</span>
            </span>
          </div>
          <div className="card p-8 shadow-card-hover">
            <Outlet />
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
            © 2024 CyberSentinel · Security Operations Platform
          </p>
        </div>
      </div>
    </div>
  );
}
