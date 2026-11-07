import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const nav = [
  { to: '/', label: 'Dashboard', icon: '⌂' },
  { to: '/extensions', label: 'Extensions', icon: '☎' },
  { to: '/trunks', label: 'Trunks', icon: '⇄' },
  { to: '/outbound-routes', label: 'Outbound routes', icon: '↗' },
  { to: '/inbound-routes', label: 'Inbound routes', icon: '↙' },
  { to: '/ring-groups', label: 'Ring groups', icon: '○' },
  { to: '/ivrs', label: 'IVRs', icon: '☰' },
  { to: '/prompts', label: 'Prompts', icon: '♪' },
  { to: '/voicemail', label: 'Voicemail', icon: '✉' },
  { to: '/security', label: 'Security', icon: '🛡' },
  { to: '/snapshots', label: 'Snapshots', icon: '⟳' },
  { to: '/logs', label: 'Logs', icon: '≡' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function Shell({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--bg-elevated)] p-4 md:flex md:flex-col">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--accent)] text-white font-bold">P</div>
          <div>
            <div className="text-sm font-semibold">BetterPBX</div>
            <div className="text-xs text-[var(--muted)]">Console</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="w-4 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <div className="mb-2 px-2 text-xs text-[var(--muted)]">{user?.username}</div>
          <button
            className="btn btn-ghost w-full"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 md:hidden">
          <span className="text-sm font-semibold">BetterPBX</span>
          <button className="btn btn-ghost" onClick={async () => { await logout(); navigate('/login', { replace: true }); }}>
            Sign out
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
