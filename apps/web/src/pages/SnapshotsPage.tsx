import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export function SnapshotsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['snapshots'], queryFn: api.snapshots });
  const [selected, setSelected] = useState<string | null>(null);
  const diff = useQuery({ queryKey: ['diff', selected], queryFn: () => api.diff(selected!), enabled: !!selected });
  const rollback = useMutation({
    mutationFn: (sha: string) => api.rollback(sha),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['snapshots'] }),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Snapshots</h1>
        <ul className="space-y-1">
          {(data ?? []).map((s) => (
            <li key={s.sha} className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-2 text-sm">
              <button className="text-left" onClick={() => setSelected(s.sha)}>
                {s.shortSha} — {s.message}
              </button>
              <button className="text-xs text-amber-400" onClick={() => rollback.mutate(s.sha)}>Rollback</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded border border-slate-800 bg-slate-900 p-3">
        <h2 className="mb-2 text-lg font-medium">Diff</h2>
        <pre className="max-h-96 overflow-auto text-xs">{diff.data?.diff ?? 'Select a snapshot'}</pre>
      </div>
    </div>
  );
}