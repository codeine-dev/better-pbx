import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Codec, Trunk } from '@better-pbx/shared';
import { api } from '../lib/api';

const CODECS: Codec[] = ['ulaw', 'alaw', 'gsm', 'g722'];

interface TrunkForm {
  name: string;
  host: string;
  port: number;
  transport: 'udp' | 'tls';
  username: string;
  password: string;
  fromUser: string;
  fromDomain: string;
  callerId: string;
  codecs: Codec[];
  inboundMode: 'registration' | 'ip';
  providerCidrs: string;
  enabled: boolean;
}

const empty = (): TrunkForm => ({
  name: '', host: '', port: 5060, transport: 'udp', username: '', password: '',
  fromUser: '', fromDomain: '', callerId: '', codecs: ['ulaw', 'alaw'],
  inboundMode: 'registration', providerCidrs: '', enabled: true,
});

function toForm(t: Trunk): TrunkForm {
  return {
    name: t.name, host: t.host, port: t.port, transport: t.transport,
    username: t.username ?? '', password: '', fromUser: t.fromUser ?? '',
    fromDomain: t.fromDomain ?? '', callerId: t.callerId ?? '',
    codecs: t.codecs as Codec[], inboundMode: t.inboundMode,
    providerCidrs: (t.providerCidrs ?? []).join(', '), enabled: t.enabled,
  };
}

function fromForm(f: TrunkForm, editing: boolean) {
  const body: Record<string, unknown> = {
    name: f.name, host: f.host, port: f.port, transport: f.transport,
    codecs: f.codecs, inboundMode: f.inboundMode, enabled: f.enabled,
    callerId: f.callerId || undefined,
    fromUser: f.fromUser || undefined,
    fromDomain: f.fromDomain || undefined,
    providerCidrs: f.providerCidrs.split(',').map((s) => s.trim()).filter(Boolean),
  };
  if (f.username) body.username = f.username;
  if (f.password) body.password = f.password;
  if (editing && !f.username) body.username = undefined;
  return body;
}

export function TrunksPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['trunks'], queryFn: api.trunks });
  const [form, setForm] = useState<TrunkForm>(empty());
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['trunks'] });

  const create = useMutation({
    mutationFn: () => api.createTrunk(fromForm(form, false)),
    onSuccess: () => { setForm(empty()); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const update = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('no editing');
      return api.patchTrunk(editing, fromForm(form, true));
    },
    onSuccess: () => { setEditing(null); setForm(empty()); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTrunk(id),
    onSuccess: () => invalidate(),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Trunks</h1>
      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="font-medium">{editing ? 'Edit trunk' : 'New trunk'}</span>
          {editing && <button className="btn btn-ghost" onClick={() => { setEditing(null); setForm(empty()); }}>Cancel</button>}
        </div>
        <div className="card-body space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Host</label><input className="input" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} /></div>
            <div><label className="label">Port</label><input type="number" className="input" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} /></div>
            <div>
              <label className="label">Transport</label>
              <select className="select" value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value as 'udp' | 'tls' })}>
                <option value="udp">UDP</option>
                <option value="tls">TLS</option>
              </select>
            </div>
            <div><label className="label">Username</label><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div><label className="label">Password</label><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? 'leave blank to keep' : ''} /></div>
            <div><label className="label">From user</label><input className="input" value={form.fromUser} onChange={(e) => setForm({ ...form, fromUser: e.target.value })} /></div>
            <div><label className="label">From domain</label><input className="input" value={form.fromDomain} onChange={(e) => setForm({ ...form, fromDomain: e.target.value })} /></div>
            <div><label className="label">Caller ID</label><input className="input" value={form.callerId} onChange={(e) => setForm({ ...form, callerId: e.target.value })} /></div>
            <div>
              <label className="label">Inbound mode</label>
              <select className="select" value={form.inboundMode} onChange={(e) => setForm({ ...form, inboundMode: e.target.value as 'registration' | 'ip' })}>
                <option value="registration">Registration</option>
                <option value="ip">IP authentication</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Codecs</label>
            <div className="flex flex-wrap gap-3">
              {CODECS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.codecs.includes(c)} onChange={(e) => {
                    const next = e.target.checked ? [...form.codecs, c] : form.codecs.filter((x) => x !== c);
                    setForm({ ...form, codecs: next as Codec[] });
                  }} />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div><label className="label">Provider CIDRs (comma separated, required for IP mode)</label>
            <input className="input" value={form.providerCidrs} onChange={(e) => setForm({ ...form, providerCidrs: e.target.value })} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled
          </label>

          <button className="btn btn-primary" disabled={create.isPending || update.isPending} onClick={() => (editing ? update.mutate() : create.mutate())}>
            {editing ? 'Save changes' : 'Add trunk'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="font-medium">Existing trunks</span><span className="badge">{(data ?? []).length}</span></div>
        <div className="card-body">
          {(data ?? []).length === 0 ? <div className="empty">No trunks yet.</div> : (
            <ul className="space-y-2">
              {(data ?? []).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border)] bg-black/20 p-3">
                  <div>
                    <div className="font-medium">{t.name} — {t.host}:{t.port}</div>
                    <div className="text-xs text-[var(--muted)]">{t.transport.toUpperCase()} · {t.inboundMode} · {t.codecs.join(', ')} · {t.enabled ? 'enabled' : 'disabled'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => { setEditing(t.id); setForm(toForm(t as unknown as Trunk)); }}>Edit</button>
                    <button className="btn btn-danger" onClick={() => remove.mutate(t.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
