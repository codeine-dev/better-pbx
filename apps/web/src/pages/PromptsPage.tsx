import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { Prompt } from '@better-pbx/shared';
import { api } from '../lib/api';

export function PromptsPage() {
  const qc = useQueryClient();
  const { data: prompts } = useQuery({ queryKey: ['prompts'], queryFn: api.prompts });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['prompts'] });

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
      return api.uploadPrompt({ name: name || file.name, originalName: file.name, content });
    },
    onSuccess: () => { setName(''); if (fileRef.current) fileRef.current.value = ''; setError(null); invalidate(); },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deletePrompt(id),
    onSuccess: () => invalidate(),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Prompts</h1>
      {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <div className="card">
        <div className="card-header"><span className="font-medium">Upload prompt</span></div>
        <div className="card-body space-y-3">
          <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" /></div>
          <div><label className="label">Audio file</label><input ref={fileRef} type="file" accept="audio/*" className="input" /></div>
          <button className="btn btn-primary" disabled={upload.isPending} onClick={() => upload.mutate()}>Upload</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="font-medium">Existing prompts</span><span className="badge">{(prompts ?? []).length}</span></div>
        <div className="card-body">
          {(prompts ?? []).length === 0 ? <div className="empty">No prompts yet.</div> : (
            <ul className="space-y-2">
              {(prompts ?? []).map((p: Prompt) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border)] bg-black/20 p-3">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-[var(--muted)]">{p.kind} · {p.file}{p.originalName ? ` · ${p.originalName}` : ''}</div>
                  </div>
                  <button className="btn btn-danger" onClick={() => remove.mutate(p.id)}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
