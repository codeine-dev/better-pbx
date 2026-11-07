import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Destination, InboundRoute, Trunk } from '@better-pbx/shared';
import { api } from '../lib/api';
import { DestinationPicker } from '../components/DestinationPicker';

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
  const { data: routes } = useQuery({ queryKey: ['inbound-routes'], queryFn: api.inboundRoutes });
  const { data: trunks } = useQuery({ queryKey: ['trunks'], queryFn: api.trunks });
  const [form, setForm] = useState<Form>(empty());
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['inbound-routes'] });

  const create = useMutation({
    mutationFn: () => api.createInboundRoute({ ...form, trunkId: form.trunkId || undefined, callerIdFilter: form.callerIdFilter || undefined }),
    onSuccess: () => { setForm(empty()); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const update = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('no editing');
      return api.patchInboundRoute(editing, form);
    },
    onSuccess: () => { setEditing(null); setForm(empty()); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteInboundRoute(id),
    onSuccess: () => invalidate(),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inbound routes</h1>
      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="font-medium">{editing ? 'Edit inbound route' : 'New inbound route'}</span>
          {editing && <button className="btn btn-ghost" onClick={() => { setEditing(null); setForm(empty()); }}>Cancel</button>}
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
          <button className="btn btn-primary" disabled={create.isPending || update.isPending} onClick={() => (editing ? update.mutate() : create.mutate())}>
            {editing ? 'Save changes' : 'Add inbound route'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="font-medium">Existing inbound routes</span><span className="badge">{(routes ?? []).length}</span></div>
        <div className="card-body">
          {(routes ?? []).length === 0 ? <div className="empty">No inbound routes yet.</div> : (
            <ul className="space-y-2">
              {(routes ?? []).map((r: InboundRoute) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border)] bg-black/20 p-3">
                  <div>
                    <div className="font-medium">{r.name} — {r.did}</div>
                    <div className="text-xs text-[var(--muted)]">{r.enabled ? 'enabled' : 'disabled'} · {r.destination.type}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => { setEditing(r.id); setForm({ name: r.name, did: r.did, trunkId: r.trunkId ?? '', callerIdFilter: r.callerIdFilter ?? '', destination: r.destination, enabled: r.enabled }); }}>Edit</button>
                    <button className="btn btn-danger" onClick={() => remove.mutate(r.id)}>Delete</button>
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
