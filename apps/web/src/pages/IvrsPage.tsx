import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { Destination, Ivr, Prompt } from '@better-pbx/shared';
import { api } from '../lib/api';
import { DestinationPicker } from '../components/DestinationPicker';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';

const defaultDest: Destination = { type: 'hangup' };

interface IvrOptionForm { digit: string; destination: Destination; }
interface Form {
  name: string;
  number: string;
  greetingPromptId: string;
  timeoutSeconds: number;
  maxRetries: number;
  options: IvrOptionForm[];
  timeoutDestination: Destination;
  invalidDestination: Destination | null;
  directDial: boolean;
}

const empty = (): Form => ({
  name: '', number: '', greetingPromptId: '', timeoutSeconds: 5, maxRetries: 3,
  options: [], timeoutDestination: defaultDest, invalidDestination: null, directDial: false,
});

export function IvrsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: ivrs } = useQuery({ queryKey: ['ivrs'], queryFn: api.ivrs });
  const { data: prompts } = useQuery({ queryKey: ['prompts'], queryFn: api.prompts });
  const [form, setForm] = useState<Form>(empty());
  const [original, setOriginal] = useState<Form | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['ivrs'] });

  const dirty = JSON.stringify(form) !== JSON.stringify(editing ? original : empty());

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const create = useMutation({
    mutationFn: () => api.createIvr({
      name: form.name,
      number: form.number || undefined,
      greetingPromptId: form.greetingPromptId,
      timeoutSeconds: form.timeoutSeconds,
      maxRetries: form.maxRetries,
      options: form.options,
      timeoutDestination: form.timeoutDestination,
      invalidDestination: form.invalidDestination ?? undefined,
      directDial: form.directDial,
    }),
    onSuccess: () => { toast.push(`IVR ${form.name} created`, 'success'); setForm(empty()); setOriginal(null); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const update = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('no editing');
      return api.patchIvr(editing, {
        name: form.name, number: form.number || undefined, greetingPromptId: form.greetingPromptId,
        timeoutSeconds: form.timeoutSeconds, maxRetries: form.maxRetries, options: form.options,
        timeoutDestination: form.timeoutDestination, invalidDestination: form.invalidDestination ?? undefined,
        directDial: form.directDial,
      });
    },
    onSuccess: () => { toast.push(`IVR ${form.name} updated`, 'success'); setEditing(null); setForm(empty()); setOriginal(null); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteIvr(id),
    onSuccess: () => { toast.push('IVR deleted', 'success'); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  function addOption() {
    setForm({ ...form, options: [...form.options, { digit: '1', destination: defaultDest }] });
  }
  function updateOption(i: number, patch: Partial<IvrOptionForm>) {
    setForm({ ...form, options: form.options.map((o, idx) => idx === i ? { ...o, ...patch } : o) });
  }
  function startEdit(i: Ivr) {
    setEditing(i.id);
    const f = {
      name: i.name, number: i.number ?? '', greetingPromptId: i.greetingPromptId,
      timeoutSeconds: i.timeoutSeconds, maxRetries: i.maxRetries,
      options: i.options.map((o) => ({ digit: o.digit, destination: o.destination })),
      timeoutDestination: i.timeoutDestination,
      invalidDestination: i.invalidDestination ?? null, directDial: i.directDial,
    };
    setForm(f); setOriginal(f); setError(null);
  }
  function cancel() { setEditing(null); setForm(empty()); setOriginal(null); setError(null); }
  function duplicate(i: Ivr) {
    const f = {
      name: `${i.name} (copy)`, number: i.number ?? '', greetingPromptId: i.greetingPromptId,
      timeoutSeconds: i.timeoutSeconds, maxRetries: i.maxRetries,
      options: i.options.map((o) => ({ digit: o.digit, destination: o.destination })),
      timeoutDestination: i.timeoutDestination,
      invalidDestination: i.invalidDestination ?? null, directDial: i.directDial,
    };
    setEditing(null);
    setForm(f);
    setOriginal(null);
    toast.push('Duplicated — adjust and save', 'info');
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = ivrs ?? [];
    if (!q) return list;
    return list.filter((i: Ivr) => `${i.name} ${i.number ?? ''}`.toLowerCase().includes(q));
  }, [ivrs, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">IVRs</h1>
          <p className="section-desc">Automated phone menus and greetings.</p>
        </div>
        {dirty && <span className="badge badge-warning"><span className="dirty-dot" />Unsaved changes</span>}
      </div>
      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="font-medium">{editing ? `Edit IVR ${form.name}` : 'New IVR'}</span>
          {editing && <button className="btn btn-ghost" onClick={cancel}>Cancel</button>}
        </div>
        <div className="card-body space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Number (optional)</label><input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
            <div>
              <label className="label">Greeting prompt</label>
              <select className="select" value={form.greetingPromptId} onChange={(e) => setForm({ ...form, greetingPromptId: e.target.value })}>
                <option value="">Select prompt…</option>
                {(prompts ?? []).map((p: Prompt) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="label">Timeout (s)</label><input type="number" className="input" value={form.timeoutSeconds} onChange={(e) => setForm({ ...form, timeoutSeconds: Number(e.target.value) })} /></div>
            <div><label className="label">Max retries</label><input type="number" className="input" value={form.maxRetries} onChange={(e) => setForm({ ...form, maxRetries: Number(e.target.value) })} /></div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.directDial} onChange={(e) => setForm({ ...form, directDial: e.target.checked })} /> Allow direct dial
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0">Menu options</label>
              <button className="btn btn-ghost" onClick={addOption}>Add option</button>
            </div>
            <div className="space-y-3">
              {form.options.map((o, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-3">
                  <input className="input" maxLength={1} placeholder="digit" value={o.digit} onChange={(e) => updateOption(i, { digit: e.target.value })} />
                  <div className="md:col-span-2">
                    <DestinationPicker value={o.destination} onChange={(d) => updateOption(i, { destination: d })} />
                  </div>
                  <button className="btn btn-danger" onClick={() => setForm({ ...form, options: form.options.filter((_, idx) => idx !== i) })}>Remove</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Timeout destination</label>
            <DestinationPicker value={form.timeoutDestination} onChange={(d) => setForm({ ...form, timeoutDestination: d })} />
          </div>
          <div>
            <label className="label">Invalid destination (optional)</label>
            <label className="flex items-center gap-2 text-sm mb-2">
              <input type="checkbox" checked={!!form.invalidDestination} onChange={(e) => setForm({ ...form, invalidDestination: e.target.checked ? defaultDest : null })} />
              Set invalid destination
            </label>
            {form.invalidDestination && (
              <DestinationPicker value={form.invalidDestination} onChange={(d) => setForm({ ...form, invalidDestination: d })} />
            )}
          </div>

          <div className="save-bar">
            <button className="btn btn-primary" disabled={create.isPending || update.isPending} onClick={() => (editing ? update.mutate() : create.mutate())}>
              {editing ? 'Save changes' : 'Add IVR'}
            </button>
            {dirty && <span className="text-xs text-[var(--muted)]">Unsaved changes</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Existing IVRs</span>
          <div className="flex items-center gap-2">
            <input className="input" style={{ width: 220 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="badge">{(ivrs ?? []).length}</span>
          </div>
        </div>
        <div className="card-body">
          {(ivrs ?? []).length === 0 ? (
            <EmptyState title="No IVRs yet" hint="Create one above." />
          ) : filtered.length === 0 ? (
            <EmptyState title="No matches" hint="Try a different search." />
          ) : (
            <ul className="space-y-2">
              {filtered.map((i: Ivr) => (
                <li key={i.id} className={`flex flex-wrap items-center justify-between gap-3 rounded border p-3 ${editing === i.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--panel-2)]'}`}>
                  <div>
                    <div className="font-medium">{i.name}{i.number ? ` — ${i.number}` : ''}</div>
                    <div className="text-xs text-[var(--muted)]">{i.options.length} options · timeout {i.timeoutSeconds}s · {i.directDial ? 'direct dial' : ''}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => startEdit(i as Ivr)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => duplicate(i as Ivr)}>Duplicate</button>
                    <button className="btn btn-danger" onClick={() => { if (window.confirm(`Delete IVR ${i.name}?`)) remove.mutate(i.id); }}>Delete</button>
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