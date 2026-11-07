import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export function ExtensionsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['extensions'], queryFn: api.extensions });
  const [number, setNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const create = useMutation({
    mutationFn: () => api.createExtension({ number, displayName }),
    onSuccess: () => {
      setNumber('');
      setDisplayName('');
      void qc.invalidateQueries({ queryKey: ['extensions'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteExtension(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['extensions'] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Extensions</h1>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <input className="rounded border border-slate-700 bg-slate-800 px-3 py-2" placeholder="Number" value={number} onChange={(e) => setNumber(e.target.value)} />
        <input className="rounded border border-slate-700 bg-slate-800 px-3 py-2" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <button className="rounded bg-emerald-600 px-3 py-2" type="submit">Add</button>
      </form>
      <ul className="space-y-2">
        {(data ?? []).map((ext) => (
          <li key={ext.id} className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-3">
            <span>{ext.number} — {ext.displayName}</span>
            <button className="text-sm text-red-400" onClick={() => remove.mutate(ext.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}