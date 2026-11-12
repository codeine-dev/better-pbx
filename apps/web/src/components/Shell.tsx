import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

const navGroups = [
  { title: 'Overview', items: [
    { to: '/', label: 'Dashboard', icon: '⌂' },
  ]},
  { title: 'Telephony', items: [
    { to: '/extensions', label: 'Extensions', icon: '☎' },
    { to: '/trunks', label: 'Trunks', icon: '⇄' },
    { to: '/ring-groups', label: 'Ring groups', icon: '○' },
    { to: '/ivrs', label: 'IVRs', icon: '☰' },
    { to: '/voicemail', label: 'Voicemail', icon: '✉' },
  ]},
  { title: 'Routing', items: [
    { to: '/outbound-routes', label: 'Outbound routes', icon: '↗' },
    { to: '/inbound-routes', label: 'Inbound routes', icon: '↙' },
  ]},
  { title: 'Media', items: [
    { to: '/prompts', label: 'Prompts', icon: '♪' },
    { to: '/music-on-hold', label: 'Music on hold', icon: '♫' },
  ]},
  { title: 'System', items: [
    { to: '/security', label: 'Security', icon: '🛡' },
    { to: '/snapshots', label: 'Snapshots', icon: '⟳' },
    { to: '/logs', label: 'Logs', icon: '≡' },
    { to: '/settings', label: 'Settings', icon: '⚙' },
  ]},
];

export function Shell({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: sys } = useQuery({ queryKey: ['system-status'], queryFn: api.systemStatus, staleTime: 60_000 });
  const [dark, setDark] = useState(() => (typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  function toggleTheme() {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <aside className="hidden h-screen w-[300px] shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-elevated)] md:fixed md:left-0 md:top-0 md:block">
        <div className="sidebar-header flex items-center gap-3 px-8 py-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-white font-extrabold shadow-md">P</div>
          <div>
            <div className="text-base font-extrabold text-[var(--text-strong)]">BetterPBX</div>
            <div className="text-xs font-semibold text-[var(--muted)]">Console</div>
          </div>
        </div>
        <nav className="px-6 pb-6">
          {navGroups.map((group) => (
            <div key={group.title}>
              <div className="sidebar-title">{group.title}</div>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.to} className="sidebar-item">
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                      <span className="w-5 text-center text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-auto border-t border-[var(--border)] p-6">
          <div className="mb-3 px-2 text-xs font-semibold text-[var(--muted)]">{user?.username}</div>
          <div className="mb-3 px-2 text-[10px] font-mono text-[var(--muted)]">
            v{sys?.version ?? '…'} · {sys?.gitHead ? sys.gitHead.slice(0, 7) : 'dev'}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost flex-1" onClick={toggleTheme} aria-label="Toggle theme">
              {dark ? '☀ Light' : '☾ Dark'}
            </button>
            <button
              className="btn btn-ghost flex-1"
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <div className="flex flex-1 flex-col md:ml-[300px]">
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 md:hidden">
          <span className="text-sm font-bold text-[var(--text-strong)]">BetterPBX</span>
          <button className="btn btn-ghost" onClick={async () => { await logout(); navigate('/login', { replace: true }); }}>
            Sign out
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}