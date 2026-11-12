import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';

export function SnapshotsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['snapshots'], queryFn: api.snapshots });
  const [selected, setSelected] = useState<string | null>(null);
  const diff = useQuery({ queryKey: ['diff', selected], queryFn: () => api.diff(selected!), enabled: !!selected });
  const rollback = useMutation({
    mutationFn: (sha: string) => api.rollback(sha),
    onSuccess: () => { toast.push('Rolled back', 'success'); void qc.invalidateQueries({ queryKey: ['snapshots'] }); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Snapshots</h1>
        <p className="section-desc">Git history of configuration changes. Roll back any commit.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="card-header"><span className="font-medium">Commits</span><span className="badge">{(data ?? []).length}</span></div>
          <div className="card-body">
            {(data ?? []).length === 0 ? (
              <EmptyState title="No snapshots yet" />
            ) : (
              <ul className="space-y-1">
                {(data ?? []).map((s) => (
                  <li key={s.sha} className={`flex items-center justify-between rounded border p-2 text-sm ${selected === s.sha ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--panel-2)]'}`}>
                    <button className="text-left" onClick={() => setSelected(s.sha)}>
                      <div className="font-medium">{s.shortSha} — {s.message}</div>
                      <div className="text-xs text-[var(--muted)]">{s.author} · {s.date}</div>
                    </button>
                    <button className="btn btn-danger" onClick={() => { if (window.confirm(`Roll back to ${s.shortSha}?`)) rollback.mutate(s.sha); }}>Rollback</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="font-medium">Diff</span></div>
          <div className="card-body">
            <pre className="max-h-96 overflow-auto text-xs">{diff.data?.diff ?? 'Select a snapshot'}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}