import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export function SecurityPage() {
  const qc = useQueryClient();
  const bans = useQuery({ queryKey: ['bans'], queryFn: api.bans });
  const audit = useQuery({ queryKey: ['audit'], queryFn: api.audit });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const [ip, setIp] = useState('');
  const unban = useMutation({
    mutationFn: (target: string) => api.unban(target),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bans'] }),
  });

  const sec = (settings.data as { security?: { whitelist?: string[]; blacklist?: string[] } })?.security;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Security</h1>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Live bans</h2>
        <div className="flex gap-2">
          <input className="rounded border border-slate-700 bg-slate-800 px-3 py-2" placeholder="IP to unban" value={ip} onChange={(e) => setIp(e.target.value)} />
          <button className="rounded bg-red-600 px-3 py-2" onClick={() => { if (ip) unban.mutate(ip); }}>Unban</button>
        </div>
        <ul className="space-y-1">
          {(bans.data ?? []).map((b) => (
            <li key={b.ip} className="flex justify-between rounded border border-slate-800 bg-slate-900 p-2 text-sm">
              <span>{b.ip} — {b.source} {b.expiresAt ? `(expires ${b.expiresAt})` : ''}</span>
              <button className="text-red-400" onClick={() => unban.mutate(b.ip)}>Unban</button>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Whitelist</h2>
        <ul className="text-sm text-slate-300">{(sec?.whitelist ?? []).map((c) => <li key={c}>{c}</li>)}</ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Blacklist</h2>
        <ul className="text-sm text-slate-300">{(sec?.blacklist ?? []).map((c) => <li key={c}>{c}</li>)}</ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Audit log</h2>
        <ul className="space-y-1 text-xs">
          {(audit.data ?? []).slice(0, 50).map((a) => (
            <li key={a.id} className="rounded border border-slate-800 bg-slate-900 p-2">
              {a.createdAt} — {a.actor} — {a.action} {a.target ?? ''} {a.commitSha ? `(${a.commitSha.slice(0, 7)})` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}