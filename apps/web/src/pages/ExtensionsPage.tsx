import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { Codec, Extension } from '@better-pbx/shared';
import { api } from '../lib/api';
import { Collapsible } from '../components/Collapsible';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';

const CODECS: Codec[] = ['ulaw', 'alaw', 'gsm', 'g722'];

interface ExtForm {
  number: string;
  displayName: string;
  secret: string;
  codecs: Codec[];
  enabled: boolean;
  transport: 'udp' | 'tls';
  maxContacts: number;
  callerId: string;
  vmEnabled: boolean;
  vmPin: string;
  vmEmail: string;
}

const emptyForm = (): ExtForm => ({
  number: '',
  displayName: '',
  secret: '',
  codecs: ['ulaw', 'alaw'],
  enabled: true,
  transport: 'udp',
  maxContacts: 2,
  callerId: '',
  vmEnabled: false,
  vmPin: '',
  vmEmail: '',
});

function toForm(e: Omit<Extension, "secret">): ExtForm {
  return {
    number: e.number,
    displayName: e.displayName,
    secret: '',
    codecs: e.codecs as Codec[],
    enabled: e.enabled,
    transport: e.transport,
    maxContacts: e.maxContacts,
    callerId: e.callerId ?? '',
    vmEnabled: e.voicemail.enabled,
    vmPin: e.voicemail.pin ?? '',
    vmEmail: e.voicemail.email ?? '',
  };
}

function fromForm(f: ExtForm) {
  return {
    number: f.number,
    displayName: f.displayName || undefined,
    secret: f.secret || undefined,
    codecs: f.codecs,
    enabled: f.enabled,
    transport: f.transport,
    maxContacts: f.maxContacts,
    callerId: f.callerId || undefined,
    voicemail: {
      enabled: f.vmEnabled,
      pin: f.vmPin || undefined,
      email: f.vmEmail || undefined,
    },
  };
}

export function ExtensionsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['extensions'], queryFn: api.extensions });
  const [form, setForm] = useState<ExtForm>(emptyForm());
  const [original, setOriginal] = useState<ExtForm | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['extensions'] });

  const dirty = editing
    ? JSON.stringify(form) !== JSON.stringify(original)
    : JSON.stringify(form) !== JSON.stringify(emptyForm());

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const create = useMutation({
    mutationFn: () => api.createExtension(fromForm(form)),
    onSuccess: (d) => {
      if (d.secret) setRevealed(d.secret);
      toast.push(`Extension ${form.number} created`, 'success');
      setForm(emptyForm());
      setOriginal(null);
      setError(null);
      invalidate();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const update = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('no editing');
      const body: Record<string, unknown> = { ...fromForm(form) };
      delete body.number;
      delete body.secret;
      return api.patchExtension(editing, body);
    },
    onSuccess: () => {
      toast.push(`Extension ${form.number} updated`, 'success');
      setEditing(null);
      setForm(emptyForm());
      setOriginal(null);
      setError(null);
      invalidate();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteExtension(id),
    onSuccess: () => { toast.push('Extension deleted', 'success'); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const resetSecret = useMutation({
    mutationFn: (id: string) => api.patchExtension(id, { resetSecret: true }),
    onSuccess: (d) => {
      if (d.secret) setRevealed(d.secret);
      toast.push('Secret reset', 'success');
      invalidate();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  function startEdit(e: Omit<Extension, "secret">) {
    setEditing(e.id);
    const f = toForm(e);
    setForm(f);
    setOriginal(f);
    setRevealed(null);
    setError(null);
  }

  function duplicate(e: Omit<Extension, "secret">) {
    const f = toForm(e);
    f.number = '';
    f.secret = '';
    setEditing(null);
    setForm(f);
    setOriginal(null);
    setRevealed(null);
    toast.push('Duplicated — set a new number and save', 'info');
  }

  function cancel() {
    setEditing(null);
    setForm(emptyForm());
    setOriginal(null);
    setError(null);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((e: Omit<Extension, "secret">) => `${e.number} ${e.displayName}`.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Extensions</h1>
          <p className="section-desc">SIP endpoints for users and devices.</p>
        </div>
        {dirty && <span className="badge badge-warning"><span className="dirty-dot" />Unsaved changes</span>}
      </div>

      {revealed && (
        <div className="card card-body border-[var(--success)]">
          <div className="text-sm font-medium text-[var(--success)]">Secret (shown once)</div>
          <code className="mt-2 block break-all rounded bg-[var(--panel-2)] p-2 text-sm">{revealed}</code>
          <button className="btn btn-ghost mt-3" onClick={() => setRevealed(null)}>Dismiss</button>
        </div>
      )}

      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="font-medium">{editing ? `Edit extension ${form.number}` : 'New extension'}</span>
          {editing && <button className="btn btn-ghost" onClick={cancel}>Cancel</button>}
        </div>
        <div className="card-body space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Number</label>
              <input className="input" value={form.number} disabled={!!editing} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="e.g. 101" />
            </div>
            <div>
              <label className="label">Display name</label>
              <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
            {!editing && (
              <div>
                <label className="label">Secret (optional)</label>
                <input className="input" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} placeholder="auto-generated if blank" />
              </div>
            )}
          </div>

          <Collapsible title="Advanced options" hint="transport, codecs, voicemail…" defaultOpen={!!editing}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Transport</label>
                <select className="select" value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value as 'udp' | 'tls' })}>
                  <option value="udp">UDP</option>
                  <option value="tls">TLS</option>
                </select>
              </div>
              <div>
                <label className="label">Max contacts</label>
                <input type="number" className="input" value={form.maxContacts} onChange={(e) => setForm({ ...form, maxContacts: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Caller ID</label>
                <input className="input" value={form.callerId} onChange={(e) => setForm({ ...form, callerId: e.target.value })} />
              </div>
            </div>

            <div className="mt-3">
              <label className="label">Codecs</label>
              <div className="flex flex-wrap gap-3">
                {CODECS.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.codecs.includes(c)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.codecs, c]
                          : form.codecs.filter((x) => x !== c);
                        setForm({ ...form, codecs: next as Codec[] });
                      }}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              Enabled
            </label>

            <div className="mt-3 rounded border border-[var(--border)] p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={form.vmEnabled} onChange={(e) => setForm({ ...form, vmEnabled: e.target.checked })} />
                Voicemail enabled
              </label>
              {form.vmEnabled && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="label">PIN</label>
                    <input className="input" value={form.vmPin} onChange={(e) => setForm({ ...form, vmPin: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input className="input" value={form.vmEmail} onChange={(e) => setForm({ ...form, vmEmail: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          </Collapsible>

          <div className="save-bar">
            <button
              className="btn btn-primary"
              disabled={create.isPending || update.isPending}
              onClick={() => (editing ? update.mutate() : create.mutate())}
            >
              {editing ? 'Save changes' : 'Add extension'}
            </button>
            {editing && (
              <button className="btn btn-ghost" onClick={() => create.mutate()} disabled={create.isPending} title="Save as a new extension">
                Save as new
              </button>
            )}
            {dirty && <span className="text-xs text-[var(--muted)]">Unsaved changes</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Existing extensions</span>
          <div className="flex items-center gap-2">
            <input className="input" style={{ width: 220 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="badge">{(data ?? []).length}</span>
          </div>
        </div>
        <div className="card-body">
          {(data ?? []).length === 0 ? (
            <EmptyState title="No extensions yet" hint="Create your first extension above." />
          ) : filtered.length === 0 ? (
            <EmptyState title="No matches" hint="Try a different search." />
          ) : (
            <ul className="space-y-2">
              {filtered.map((ext: Omit<Extension, "secret">) => (
                <li key={ext.id} className={`flex flex-wrap items-center justify-between gap-3 rounded border p-3 ${editing === ext.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--panel-2)]'}`}>
                  <div>
                    <div className="font-medium">{ext.number} — {ext.displayName}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {ext.transport.toUpperCase()} · {ext.codecs.join(', ')} · {ext.enabled ? 'enabled' : 'disabled'}
                      {ext.voicemail.enabled ? ' · voicemail' : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => startEdit(ext)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => duplicate(ext)}>Duplicate</button>
                    <button className="btn btn-ghost" onClick={() => resetSecret.mutate(ext.id)}>Reset secret</button>
                    <button className="btn btn-danger" onClick={() => { if (window.confirm(`Delete extension ${ext.number}?`)) remove.mutate(ext.id); }}>Delete</button>
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