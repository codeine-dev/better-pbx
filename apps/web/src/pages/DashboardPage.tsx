import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function DashboardPage() {
  const status = useQuery({ queryKey: ['system-status'], queryFn: api.systemStatus });
  const bans = useQuery({ queryKey: ['bans'], queryFn: api.bans });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <div className="text-sm text-slate-400">Version</div>
          <div className="text-xl">{status.data?.version ?? '—'}</div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <div className="text-sm text-slate-400">Uptime (s)</div>
          <div className="text-xl">{status.data?.uptimeSeconds ?? '—'}</div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <div className="text-sm text-slate-400">Active bans</div>
          <div className="text-xl">{bans.data?.length ?? 0}</div>
        </div>
      </div>
    </div>
  );
}