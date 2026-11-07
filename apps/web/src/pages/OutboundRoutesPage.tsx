import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export function OutboundRoutesPage() {
  const qc = useQueryClient();
  const { data: routes } = useQuery({ queryKey: ['outbound-routes'], queryFn: api.outboundRoutes });
  const { data: trunks } = useQuery({ queryKey: ['trunks'], queryFn: api.trunks });
  const [name, setName] = useState('');
  const [trunkId, setTrunkId] = useState('');
  const [pattern, setPattern] = useState('_9NXXXXXX');
  const create = useMutation({
    mutationFn: () => api.createOutboundRoute({ name, trunkId, patterns: [{ match: pattern, strip: 1, prepend: '' }] }),
    onSuccess: () => {
      setName('');
      void qc.invalidateQueries({ queryKey: ['outbound-routes'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteOutboundRoute(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['outbound-routes'] }),
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Outbound routes</h1>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <input className="rounded border border-slate-700 bg-slate-800 px-3 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="rounded border border-slate-700 bg-slate-800 px-3 py-2" value={trunkId} onChange={(e) => setTrunkId(e.target.value)}>
          <option value="">Select trunk</option>
          {(trunks ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input className="rounded border border-slate-700 bg-slate-800 px-3 py-2" value={pattern} onChange={(e) => setPattern(e.target.value)} />
        <button className="rounded bg-emerald-600 px-3 py-2" type="submit">Add</button>
      </form>
      <ul className="space-y-2">
        {(routes ?? []).map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-3">
            <span>{r.name} (priority {r.priority})</span>
            <button className="text-sm text-red-400" onClick={() => remove.mutate(r.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}