import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Codec, Extension } from '@better-pbx/shared';
import { api } from '../lib/api';

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

function toForm(e: Extension): ExtForm {
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
  const { data } = useQuery({ queryKey: ['extensions'], queryFn: api.extensions });
  const [form, setForm] = useState<ExtForm>(emptyForm());
  const [editing, setEditing] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['extensions'] });

  const create = useMutation({
    mutationFn: () => api.createExtension(fromForm(form)),
    onSuccess: (d) => {
      if (d.secret) setRevealed(d.secret);
      setForm(emptyForm());
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
      setEditing(null);
      setForm(emptyForm());
      setError(null);
      invalidate();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteExtension(id),
    onSuccess: () => invalidate(),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const resetSecret = useMutation({
    mutationFn: (id: string) => api.patchExtension(id, { resetSecret: true }),
    onSuccess: (d) => {
      if (d.secret) setRevealed(d.secret);
      invalidate();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  function startEdit(e: Extension) {
    setEditing(e.id);
    setForm(toForm(e));
    setRevealed(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Extensions</h1>
      </div>

      {revealed && (
        <div className="card card-body border-[var(--success)]">
          <div className="text-sm font-medium text-[#86efac]">Secret (shown once)</div>
          <code className="mt-2 block break-all rounded bg-black/40 p-2 text-sm">{revealed}</code>
          <button className="btn btn-ghost mt-3" onClick={() => setRevealed(null)}>Dismiss</button>
        </div>
      )}

      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="font-medium">{editing ? 'Edit extension' : 'New extension'}</span>
          {editing && <button className="btn btn-ghost" onClick={() => { setEditing(null); setForm(emptyForm()); }}>Cancel</button>}
        </div>
        <div className="card-body space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Number</label>
              <input className="input" value={form.number} disabled={!!editing} onChange={(e) => setForm({ ...form, number: e.target.value })} />
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

          <div>
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

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            Enabled
          </label>
          <div className="rounded border border-[var(--border)] p-3 space-y-3">
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

          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              disabled={create.isPending || update.isPending}
              onClick={() => (editing ? update.mutate() : create.mutate())}
            >
              {editing ? 'Save changes' : 'Add extension'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Existing extensions</span>
          <span className="badge">{(data ?? []).length}</span>
        </div>
        <div className="card-body">
          {(data ?? []).length === 0 ? (
            <div className="empty">No extensions yet.</div>
          ) : (
            <ul className="space-y-2">
              {(data ?? []).map((ext) => (
                <li key={ext.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border)] bg-black/20 p-3">
                  <div>
                    <div className="font-medium">{ext.number} — {ext.displayName}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {ext.transport.toUpperCase()} · {ext.codecs.join(', ')} · {ext.enabled ? 'enabled' : 'disabled'}
                      {ext.voicemail.enabled ? ' · voicemail' : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost" onClick={() => startEdit(ext as unknown as Extension)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => resetSecret.mutate(ext.id)}>Reset secret</button>
                    <button className="btn btn-danger" onClick={() => remove.mutate(ext.id)}>Delete</button>
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
