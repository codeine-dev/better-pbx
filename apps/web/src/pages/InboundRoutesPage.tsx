import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { Destination, InboundRoute, Trunk } from '@better-pbx/shared';
import { api } from '../lib/api';
import { DestinationPicker } from '../components/DestinationPicker';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';

const defaultDest: Destination = { type: 'hangup' };

interface Form {
  name: string;
  did: string;
  trunkId: string;
  callerIdFilter: string;
  destination: Destination;
  enabled: boolean;
}

const empty = (): Form => ({ name: '', did: '', trunkId: '', callerIdFilter: '', destination: defaultDest, enabled: true });

export function InboundRoutesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: routes } = useQuery({ queryKey: ['inbound-routes'], queryFn: api.inboundRoutes });
  const { data: trunks } = useQuery({ queryKey: ['trunks'], queryFn: api.trunks });
  const [form, setForm] = useState<Form>(empty());
  const [original, setOriginal] = useState<Form | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['inbound-routes'] });

  const dirty = JSON.stringify(form) !== JSON.stringify(editing ? original : empty());

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const create = useMutation({
    mutationFn: () => api.createInboundRoute({ ...form, trunkId: form.trunkId || undefined, callerIdFilter: form.callerIdFilter || undefined }),
    onSuccess: () => { toast.push(`Inbound route ${form.name} created`, 'success'); setForm(empty()); setOriginal(null); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const update = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('no editing');
      return api.patchInboundRoute(editing, form);
    },
    onSuccess: () => { toast.push(`Inbound route ${form.name} updated`, 'success'); setEditing(null); setForm(empty()); setOriginal(null); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteInboundRoute(id),
    onSuccess: () => { toast.push('Inbound route deleted', 'success'); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  function startEdit(r: InboundRoute) {
    setEditing(r.id);
    const f = { name: r.name, did: r.did, trunkId: r.trunkId ?? '', callerIdFilter: r.callerIdFilter ?? '', destination: r.destination, enabled: r.enabled };
    setForm(f); setOriginal(f); setError(null);
  }
  function cancel() { setEditing(null); setForm(empty()); setOriginal(null); setError(null); }
  function duplicate(r: InboundRoute) {
    const f = { name: `${r.name} (copy)`, did: r.did, trunkId: r.trunkId ?? '', callerIdFilter: r.callerIdFilter ?? '', destination: r.destination, enabled: r.enabled };
    setEditing(null);
    setForm(f);
    setOriginal(null);
    toast.push('Duplicated — adjust and save', 'info');
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = routes ?? [];
    if (!q) return list;
    return list.filter((r: InboundRoute) => `${r.name} ${r.did}`.toLowerCase().includes(q));
  }, [routes, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Inbound routes</h1>
          <p className="section-desc">Map incoming DIDs to destinations.</p>
        </div>
        {dirty && <span className="badge badge-warning"><span className="dirty-dot" />Unsaved changes</span>}
      </div>
      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="font-medium">{editing ? `Edit inbound route ${form.name}` : 'New inbound route'}</span>
          {editing && <button className="btn btn-ghost" onClick={cancel}>Cancel</button>}
        </div>
        <div className="card-body space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">DID / pattern</label><input className="input" value={form.did} onChange={(e) => setForm({ ...form, did: e.target.value })} /></div>
            <div>
              <label className="label">Trunk filter (optional)</label>
              <select className="select" value={form.trunkId} onChange={(e) => setForm({ ...form, trunkId: e.target.value })}>
                <option value="">Any trunk</option>
                {(trunks ?? []).map((t: Trunk) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div><label className="label">Caller ID filter (optional)</label><input className="input" value={form.callerIdFilter} onChange={(e) => setForm({ ...form, callerIdFilter: e.target.value })} /></div>
          </div>
          <div>
            <label className="label">Destination</label>
            <DestinationPicker value={form.destination} onChange={(d) => setForm({ ...form, destination: d })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled
          </label>
          <div className="save-bar">
            <button className="btn btn-primary" disabled={create.isPending || update.isPending} onClick={() => (editing ? update.mutate() : create.mutate())}>
              {editing ? 'Save changes' : 'Add inbound route'}
            </button>
            {dirty && <span className="text-xs text-[var(--muted)]">Unsaved changes</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Existing inbound routes</span>
          <div className="flex items-center gap-2">
            <input className="input" style={{ width: 220 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="badge">{(routes ?? []).length}</span>
          </div>
        </div>
        <div className="card-body">
          {(routes ?? []).length === 0 ? (
            <EmptyState title="No inbound routes yet" hint="Add a route above." />
          ) : filtered.length === 0 ? (
            <EmptyState title="No matches" hint="Try a different search." />
          ) : (
            <ul className="space-y-2">
              {filtered.map((r: InboundRoute) => (
                <li key={r.id} className={`flex flex-wrap items-center justify-between gap-3 rounded border p-3 ${editing === r.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--panel-2)]'}`}>
                  <div>
                    <div className="font-medium">{r.name} — {r.did}</div>
                    <div className="text-xs text-[var(--muted)]">{r.enabled ? 'enabled' : 'disabled'} · {r.destination.type}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => startEdit(r as InboundRoute)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => duplicate(r as InboundRoute)}>Duplicate</button>
                    <button className="btn btn-danger" onClick={() => { if (window.confirm(`Delete inbound route ${r.name}?`)) remove.mutate(r.id); }}>Delete</button>
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