import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';

export function SecurityPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const bans = useQuery({ queryKey: ['bans'], queryFn: api.bans });
  const audit = useQuery({ queryKey: ['audit'], queryFn: api.audit });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const [ip, setIp] = useState('');

  const unban = useMutation({
    mutationFn: (target: string) => api.unban(target),
    onSuccess: () => { toast.push('IP unbanned', 'success'); void qc.invalidateQueries({ queryKey: ['bans'] }); },
  });

  const sec = (settings.data as { security?: { whitelist?: string[]; blacklist?: string[] } })?.security;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Security</h1>
        <p className="section-desc">Live bans, whitelist/blacklist, and audit trail.</p>
      </div>

      <div className="card">
        <div className="card-header"><span className="font-medium">Live bans</span><span className="badge">{(bans.data ?? []).length}</span></div>
        <div className="card-body space-y-3">
          <div className="flex gap-2">
            <input className="input" placeholder="IP to unban" value={ip} onChange={(e) => setIp(e.target.value)} />
            <button className="btn btn-danger" onClick={() => { if (ip) unban.mutate(ip); }}>Unban</button>
          </div>
          {(bans.data ?? []).length === 0 ? (
            <EmptyState title="No active bans" />
          ) : (
            <ul className="space-y-2">
              {(bans.data ?? []).map((b) => (
                <li key={b.ip} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-sm">
                  <span>{b.ip} — {b.source} {b.expiresAt ? `(expires ${b.expiresAt})` : ''}</span>
                  <button className="btn btn-danger" onClick={() => { if (window.confirm(`Unban ${b.ip}?`)) unban.mutate(b.ip); }}>Unban</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="card-header"><span className="font-medium">Whitelist</span></div>
          <div className="card-body">
            {(sec?.whitelist ?? []).length === 0 ? (
              <EmptyState title="No whitelist entries" />
            ) : (
              <ul className="text-sm text-[var(--muted)]">{(sec?.whitelist ?? []).map((c) => <li key={c}>{c}</li>)}</ul>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="font-medium">Blacklist</span></div>
          <div className="card-body">
            {(sec?.blacklist ?? []).length === 0 ? (
              <EmptyState title="No blacklist entries" />
            ) : (
              <ul className="text-sm text-[var(--muted)]">{(sec?.blacklist ?? []).map((c) => <li key={c}>{c}</li>)}</ul>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="font-medium">Audit log</span><span className="badge">{(audit.data ?? []).length}</span></div>
        <div className="card-body">
          {(audit.data ?? []).length === 0 ? (
            <EmptyState title="No audit entries" />
          ) : (
            <ul className="space-y-1 text-xs">
              {(audit.data ?? []).slice(0, 50).map((a) => (
                <li key={a.id} className="rounded border border-[var(--border)] bg-[var(--panel-2)] p-2">
                  {a.createdAt} — {a.actor} — {a.action} {a.target ?? ''} {a.commitSha ? `(${a.commitSha.slice(0, 7)})` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}