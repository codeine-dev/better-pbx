import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { OutboundPattern, OutboundRoute, Trunk } from '@better-pbx/shared';
import { api } from '../lib/api';
import { Collapsible } from '../components/Collapsible';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';

interface RouteForm {
  name: string;
  priority: number;
  trunkId: string;
  patterns: OutboundPattern[];
  callerId: string;
  allowPremium: boolean;
  enabled: boolean;
}

const empty = (): RouteForm => ({
  name: '', priority: 100, trunkId: '', patterns: [{ match: '_X.', strip: 0, prepend: '' }],
  callerId: '', allowPremium: false, enabled: true,
});

export function OutboundRoutesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: routes } = useQuery({ queryKey: ['outbound-routes'], queryFn: api.outboundRoutes });
  const { data: trunks } = useQuery({ queryKey: ['trunks'], queryFn: api.trunks });
  const [form, setForm] = useState<RouteForm>(empty());
  const [original, setOriginal] = useState<RouteForm | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['outbound-routes'] });

  const dirty = JSON.stringify(form) !== JSON.stringify(editing ? original : empty());

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const create = useMutation({
    mutationFn: () => api.createOutboundRoute({ ...form, patterns: form.patterns }),
    onSuccess: () => { toast.push(`Route ${form.name} created`, 'success'); setForm(empty()); setOriginal(null); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const update = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('no editing');
      return api.patchOutboundRoute(editing, form);
    },
    onSuccess: () => { toast.push(`Route ${form.name} updated`, 'success'); setEditing(null); setForm(empty()); setOriginal(null); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteOutboundRoute(id),
    onSuccess: () => { toast.push('Route deleted', 'success'); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  function updatePattern(i: number, patch: Partial<OutboundPattern>) {
    const next = form.patterns.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    setForm({ ...form, patterns: next });
  }
  function startEdit(r: OutboundRoute) {
    setEditing(r.id);
    const f = { name: r.name, priority: r.priority, trunkId: r.trunkId, patterns: r.patterns, callerId: r.callerId ?? '', allowPremium: r.allowPremium, enabled: r.enabled };
    setForm(f);
    setOriginal(f);
    setError(null);
  }
  function cancel() {
    setEditing(null); setForm(empty()); setOriginal(null); setError(null);
  }
  function duplicate(r: OutboundRoute) {
    const f = { name: `${r.name} (copy)`, priority: r.priority, trunkId: r.trunkId, patterns: r.patterns, callerId: r.callerId ?? '', allowPremium: r.allowPremium, enabled: r.enabled };
    setEditing(null);
    setForm(f);
    setOriginal(null);
    toast.push('Duplicated — adjust and save', 'info');
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = routes ?? [];
    if (!q) return list;
    return list.filter((r: OutboundRoute) => `${r.name} ${r.patterns.map((p: OutboundPattern)=>p.match).join(' ')}`.toLowerCase().includes(q));
  }, [routes, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Outbound routes</h1>
          <p className="section-desc">Dial patterns that send calls out via a trunk.</p>
        </div>
        {dirty && <span className="badge badge-warning"><span className="dirty-dot" />Unsaved changes</span>}
      </div>
      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="font-medium">{editing ? `Edit route ${form.name}` : 'New route'}</span>
          {editing && <button className="btn btn-ghost" onClick={cancel}>Cancel</button>}
        </div>
        <div className="card-body space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Priority</label><input type="number" className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
            <div>
              <label className="label">Trunk</label>
              <select className="select" value={form.trunkId} onChange={(e) => setForm({ ...form, trunkId: e.target.value })}>
                <option value="">Select trunk…</option>
                {(trunks ?? []).map((t: Trunk) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0">Patterns</label>
              <button className="btn btn-ghost" onClick={() => setForm({ ...form, patterns: [...form.patterns, { match: '', strip: 0, prepend: '' }] })}>Add pattern</button>
            </div>
            <div className="space-y-2">
              {form.patterns.map((p, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-4">
                  <input className="input" placeholder="match e.g. _1NXXNXXXXXX" value={p.match} onChange={(e) => updatePattern(i, { match: e.target.value })} />
                  <input type="number" className="input" placeholder="strip" value={p.strip} onChange={(e) => updatePattern(i, { strip: Number(e.target.value) })} />
                  <input className="input" placeholder="prepend" value={p.prepend} onChange={(e) => updatePattern(i, { prepend: e.target.value })} />
                  <button className="btn btn-danger" onClick={() => setForm({ ...form, patterns: form.patterns.filter((_, idx) => idx !== i) })}>Remove</button>
                </div>
              ))}
            </div>
          </div>

          <Collapsible title="Advanced options" hint="caller ID, premium, status" defaultOpen={!!editing}>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="label">Caller ID override</label><input className="input" value={form.callerId} onChange={(e) => setForm({ ...form, callerId: e.target.value })} /></div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allowPremium} onChange={(e) => setForm({ ...form, allowPremium: e.target.checked })} /> Allow premium-rate prefixes
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled
            </label>
          </Collapsible>

          <div className="save-bar">
            <button className="btn btn-primary" disabled={create.isPending || update.isPending} onClick={() => (editing ? update.mutate() : create.mutate())}>
              {editing ? 'Save changes' : 'Add route'}
            </button>
            {dirty && <span className="text-xs text-[var(--muted)]">Unsaved changes</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Existing routes</span>
          <div className="flex items-center gap-2">
            <input className="input" style={{ width: 220 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="badge">{(routes ?? []).length}</span>
          </div>
        </div>
        <div className="card-body">
          {(routes ?? []).length === 0 ? (
            <EmptyState title="No outbound routes yet" hint="Add a route above." />
          ) : filtered.length === 0 ? (
            <EmptyState title="No matches" hint="Try a different search." />
          ) : (
            <ul className="space-y-2">
              {filtered.map((r: OutboundRoute) => (
                <li key={r.id} className={`flex flex-wrap items-center justify-between gap-3 rounded border p-3 ${editing === r.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--panel-2)]'}`}>
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-[var(--muted)]">priority {r.priority} · {r.patterns.map((p: OutboundPattern) => p.match).join(', ')} · {r.enabled ? 'enabled' : 'disabled'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => startEdit(r as OutboundRoute)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => duplicate(r as OutboundRoute)}>Duplicate</button>
                    <button className="btn btn-danger" onClick={() => { if (window.confirm(`Delete route ${r.name}?`)) remove.mutate(r.id); }}>Delete</button>
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