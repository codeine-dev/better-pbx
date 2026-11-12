import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import type { MusicOnHold } from '@better-pbx/shared';
import { api } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';

export function MusicOnHoldPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: items } = useQuery({ queryKey: ['music-on-hold'], queryFn: api.musicOnHold });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['music-on-hold'] });

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('select a file');
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const r = String(reader.result ?? '');
          resolve(r.split(',')[1] ?? '');
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      return api.uploadMusicOnHold({ name: name || file.name, originalName: file.name, content });
    },
    onSuccess: () => { toast.push('Hold music uploaded', 'success'); setName(''); if (fileRef.current) fileRef.current.value = ''; setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const create = useMutation({
    mutationFn: () => api.createMusicOnHold({ name: name || 'Hold music' }),
    onSuccess: () => { toast.push('Hold music class added', 'success'); setName(''); setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteMusicOnHold(id),
    onSuccess: () => { toast.push('Hold music deleted', 'success'); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items ?? [];
    if (!q) return list;
    return list.filter((m: MusicOnHold) => `${m.name} ${m.id}`.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Music on hold</h1>
        <p className="section-desc">Hold music classes for queues and ring groups.</p>
      </div>
      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</div>}

      <div className="card">
        <div className="card-header"><span className="font-medium">Add hold music</span></div>
        <div className="card-body space-y-3">
          <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" /></div>
          <div><label className="label">Audio file</label><input ref={fileRef} type="file" accept="audio/*" className="input" /></div>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={upload.isPending} onClick={() => upload.mutate()}>Upload</button>
            <button className="btn btn-ghost" disabled={create.isPending} onClick={() => create.mutate()}>Add empty class</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Existing hold music</span>
          <div className="flex items-center gap-2">
            <input className="input" style={{ width: 220 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <span className="badge">{(items ?? []).length}</span>
          </div>
        </div>
        <div className="card-body">
          {(items ?? []).length === 0 ? (
            <EmptyState title="No hold music yet" hint="Upload a file above." />
          ) : filtered.length === 0 ? (
            <EmptyState title="No matches" hint="Try a different search." />
          ) : (
            <ul className="space-y-2">
              {filtered.map((m: MusicOnHold) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3">
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-[var(--muted)]">{m.id}</div>
                  </div>
                  <button className="btn btn-danger" onClick={() => { if (window.confirm(`Delete hold music ${m.name}?`)) remove.mutate(m.id); }}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}