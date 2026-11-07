import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export function TrunksPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['trunks'], queryFn: api.trunks });
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const create = useMutation({
    mutationFn: () => api.createTrunk({ name, host }),
    onSuccess: () => {
      setName('');
      setHost('');
      void qc.invalidateQueries({ queryKey: ['trunks'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTrunk(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['trunks'] }),
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Trunks</h1>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <input className="rounded border border-slate-700 bg-slate-800 px-3 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded border border-slate-700 bg-slate-800 px-3 py-2" placeholder="Host" value={host} onChange={(e) => setHost(e.target.value)} />
        <button className="rounded bg-emerald-600 px-3 py-2" type="submit">Add</button>
      </form>
      <ul className="space-y-2">
        {(data ?? []).map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-3">
            <span>{t.name} — {t.host}</span>
            <button className="text-sm text-red-400" onClick={() => remove.mutate(t.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}