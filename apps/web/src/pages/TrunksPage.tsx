import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { Codec, Trunk } from '@better-pbx/shared';
import { api } from '../lib/api';
import { Collapsible } from '../components/Collapsible';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';

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
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['trunks'], queryFn: api.trunks });
  const [form, setForm] = useState<TrunkForm>(empty());
  const [original, setOriginal] = useState<TrunkForm | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['trunks'] });

  const dirty = JSON.stringify(form) !== JSON.stringify(editing ? original : empty());

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const create = useMutation({
    mutationFn: () => api.createTrunk(fromForm(form, false)),
    onSuccess: () => { toast.push(`Trunk ${form.name} created`, 'success'); setForm(empty()); setOriginal(null); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const update = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('no editing');
      return api.patchTrunk(editing, fromForm(form, true));
    },
    onSuccess: () => { toast.push(`Trunk ${form.name} updated`, 'success'); setEditing(null); setForm(empty()); setOriginal(null); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTrunk(id),
    onSuccess: () => { toast.push('Trunk deleted', 'success'); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  function startEdit(t: Trunk) {
    setEditing(t.id);
    const f = toForm(t);
    setForm(f);
    setOriginal(f);
    setError(null);
  }
  function duplicate(t: Trunk) {
    const f = toForm(t);
    f.name = `${f.name} (copy)`;
    setEditing(null);
    setForm(f);
    setOriginal(null);
    toast.push('Duplicated — adjust and save', 'info');
  }
  function cancel() {
    setEditing(null);
    setForm(empty());
    setOriginal(null);
    setError(null);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((t: Trunk) => `${t.name} ${t.host}`.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Trunks</h1>
          <p className="section-desc">Upstream SIP providers and peer connections.</p>
        </div>
        {dirty && <span className="badge badge-warning"><span className="dirty-dot" />Unsaved changes</span>}
      </div>
      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="font-medium">{editing ? `Edit trunk ${form.name}` : 'New trunk'}</span>
          {editing && <button className="btn btn-ghost" onClick={cancel}>Cancel</button>}
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
            <div><label className="label">Caller ID</label><input className="input" value={form.callerId} onChange={(e) => setForm({ ...form, callerId: e.target.value })} /></div>
          </div>

          <Collapsible title="Advanced options" hint="auth, codecs, inbound mode…" defaultOpen={!!editing}>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="label">From user</label><input className="input" value={form.fromUser} onChange={(e) => setForm({ ...form, fromUser: e.target.value })} /></div>
              <div><label className="label">From domain</label><input className="input" value={form.fromDomain} onChange={(e) => setForm({ ...form, fromDomain: e.target.value })} /></div>
              <div>
                <label className="label">Inbound mode</label>
                <select className="select" value={form.inboundMode} onChange={(e) => setForm({ ...form, inboundMode: e.target.value as 'registration' | 'ip' })}>
                  <option value="registration">Registration</option>
                  <option value="ip">IP authentication</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
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
            <div className="mt-3">
              <label className="label">Provider CIDRs (comma separated, required for IP mode)</label>
              <input className="input" value={form.providerCidrs} onChange={(e) => setForm({ ...form, providerCidrs: e.target.value })} />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled
            </label>
          </Collapsible>

          <div className="save-bar">
            <button className="btn btn-primary" disabled={create.isPending || update.isPending} onClick={() => (editing ? update.mutate() : create.mutate())}>
              {editing ? 'Save changes' : 'Add trunk'}
            </button>
            {editing && (
              <button className="btn btn-ghost" onClick={() => { if (window.confirm('Save as a new trunk?')) create.mutate(); }} disabled={create.isPending}>Save as new</button>
            )}
            {dirty && <span className="text-xs text-[var(--muted)]">Unsaved changes</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Existing trunks</span>
          <div className="flex items-center gap-2">
            <input className="input" style={{ width: 220 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="badge">{(data ?? []).length}</span>
          </div>
        </div>
        <div className="card-body">
          {(data ?? []).length === 0 ? (
            <EmptyState title="No trunks yet" hint="Add your first trunk above." />
          ) : filtered.length === 0 ? (
            <EmptyState title="No matches" hint="Try a different search." />
          ) : (
            <ul className="space-y-2">
              {filtered.map((t: Trunk) => (
                <li key={t.id} className={`flex flex-wrap items-center justify-between gap-3 rounded border p-3 ${editing === t.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--panel-2)]'}`}>
                  <div>
                    <div className="font-medium">{t.name} — {t.host}:{t.port}</div>
                    <div className="text-xs text-[var(--muted)]">{t.transport.toUpperCase()} · {t.inboundMode} · {t.codecs.join(', ')} · {t.enabled ? 'enabled' : 'disabled'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => startEdit(t as unknown as Trunk)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => duplicate(t as unknown as Trunk)}>Duplicate</button>
                    <button className="btn btn-danger" onClick={() => { if (window.confirm(`Delete trunk ${t.name}?`)) remove.mutate(t.id); }}>Delete</button>
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