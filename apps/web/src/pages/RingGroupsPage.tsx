import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { Destination, Extension, MusicOnHold, RingGroup } from '@better-pbx/shared';
import { api } from '../lib/api';
import { DestinationPicker } from '../components/DestinationPicker';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';

const defaultDest: Destination = { type: 'hangup' };

interface Form {
  name: string;
  number: string;
  strategy: 'ringall' | 'linear' | 'rrmemory';
  memberIds: string[];
  ringTime: number;
  destinationIfNoAnswer: Destination;
  musicOnHoldClassId?: string;
}

const empty = (): Form => ({ name: '', number: '', strategy: 'ringall', memberIds: [], ringTime: 20, destinationIfNoAnswer: defaultDest, musicOnHoldClassId: '' });

export function RingGroupsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: groups } = useQuery({ queryKey: ['ring-groups'], queryFn: api.ringGroups });
  const { data: exts } = useQuery({ queryKey: ['extensions'], queryFn: api.extensions });
  const { data: moh } = useQuery({ queryKey: ['music-on-hold'], queryFn: api.musicOnHold });
  const [form, setForm] = useState<Form>(empty());
  const [original, setOriginal] = useState<Form | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['ring-groups'] });

  const dirty = JSON.stringify(form) !== JSON.stringify(editing ? original : empty());

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const toBody = () => ({ ...form, musicOnHoldClassId: form.musicOnHoldClassId || undefined });
  const create = useMutation({
    mutationFn: () => api.createRingGroup(toBody()),
    onSuccess: () => { toast.push(`Ring group ${form.name} created`, 'success'); setForm(empty()); setOriginal(null); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const update = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('no editing');
      return api.patchRingGroup(editing, toBody());
    },
    onSuccess: () => { toast.push(`Ring group ${form.name} updated`, 'success'); setEditing(null); setForm(empty()); setOriginal(null); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteRingGroup(id),
    onSuccess: () => { toast.push('Ring group deleted', 'success'); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  function toggleMember(id: string) {
    setForm((f) => ({
      ...f,
      memberIds: f.memberIds.includes(id) ? f.memberIds.filter((x) => x !== id) : [...f.memberIds, id],
    }));
  }
  function startEdit(g: RingGroup) {
    setEditing(g.id);
    const f = { name: g.name, number: g.number, strategy: g.strategy, memberIds: g.memberIds, ringTime: g.ringTime, destinationIfNoAnswer: g.destinationIfNoAnswer, musicOnHoldClassId: g.musicOnHoldClassId ?? '' };
    setForm(f); setOriginal(f); setError(null);
  }
  function cancel() { setEditing(null); setForm(empty()); setOriginal(null); setError(null); }
  function duplicate(g: RingGroup) {
    const f = { name: `${g.name} (copy)`, number: g.number, strategy: g.strategy, memberIds: g.memberIds, ringTime: g.ringTime, destinationIfNoAnswer: g.destinationIfNoAnswer, musicOnHoldClassId: g.musicOnHoldClassId ?? '' };
    setEditing(null);
    setForm(f);
    setOriginal(null);
    toast.push('Duplicated — adjust and save', 'info');
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = groups ?? [];
    if (!q) return list;
    return list.filter((g: RingGroup) => `${g.name} ${g.number}`.toLowerCase().includes(q));
  }, [groups, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Ring groups</h1>
          <p className="section-desc">Ring multiple extensions at once.</p>
        </div>
        {dirty && <span className="badge badge-warning"><span className="dirty-dot" />Unsaved changes</span>}
      </div>
      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="font-medium">{editing ? `Edit ring group ${form.name}` : 'New ring group'}</span>
          {editing && <button className="btn btn-ghost" onClick={cancel}>Cancel</button>}
        </div>
        <div className="card-body space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Number</label><input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
            <div>
              <label className="label">Strategy</label>
              <select className="select" value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value as Form['strategy'] })}>
                <option value="ringall">Ring all</option>
                <option value="linear">Linear</option>
                <option value="rrmemory">Round robin</option>
              </select>
            </div>
            <div><label className="label">Ring time (s)</label><input type="number" className="input" value={form.ringTime} onChange={(e) => setForm({ ...form, ringTime: Number(e.target.value) })} /></div>
            <div>
              <label className="label">Music on hold</label>
              <select className="select" value={form.musicOnHoldClassId ?? ''} onChange={(e) => setForm({ ...form, musicOnHoldClassId: e.target.value })}>
                <option value="">Dial tone (regional default)</option>
                {(moh ?? []).map((m: MusicOnHold) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Members</label>
            <div className="grid gap-2 md:grid-cols-3">
              {(exts ?? []).map((e: Omit<Extension, "secret">) => (
                <label key={e.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.memberIds.includes(e.id)} onChange={() => toggleMember(e.id)} />
                  {e.number} — {e.displayName}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">If no answer</label>
            <DestinationPicker value={form.destinationIfNoAnswer} onChange={(d) => setForm({ ...form, destinationIfNoAnswer: d })} />
          </div>

          <div className="save-bar">
            <button className="btn btn-primary" disabled={create.isPending || update.isPending} onClick={() => (editing ? update.mutate() : create.mutate())}>
              {editing ? 'Save changes' : 'Add ring group'}
            </button>
            {dirty && <span className="text-xs text-[var(--muted)]">Unsaved changes</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Existing ring groups</span>
          <div className="flex items-center gap-2">
            <input className="input" style={{ width: 220 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="badge">{(groups ?? []).length}</span>
          </div>
        </div>
        <div className="card-body">
          {(groups ?? []).length === 0 ? (
            <EmptyState title="No ring groups yet" hint="Create one above." />
          ) : filtered.length === 0 ? (
            <EmptyState title="No matches" hint="Try a different search." />
          ) : (
            <ul className="space-y-2">
              {filtered.map((g: RingGroup) => (
                <li key={g.id} className={`flex flex-wrap items-center justify-between gap-3 rounded border p-3 ${editing === g.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--panel-2)]'}`}>
                  <div>
                    <div className="font-medium">{g.name} — {g.number}</div>
                    <div className="text-xs text-[var(--muted)]">{g.strategy} · {g.memberIds.length} members · {g.ringTime}s</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => startEdit(g as RingGroup)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => duplicate(g as RingGroup)}>Duplicate</button>
                    <button className="btn btn-danger" onClick={() => { if (window.confirm(`Delete ring group ${g.name}?`)) remove.mutate(g.id); }}>Delete</button>
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