import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="hidden w-60 border-r border-slate-800 p-4 md:block">
        <div className="mb-6 text-lg font-semibold">BetterPBX</div>
        <nav className="space-y-1 text-sm">
          <a className="block rounded px-2 py-1 hover:bg-slate-800" href="/">Dashboard</a>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <span className="text-sm text-slate-400">{user?.username}</span>
          <button
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className="rounded border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 p-4">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}