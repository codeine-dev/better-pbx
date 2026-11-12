import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { EmptyState } from '../components/EmptyState';

export function VoicemailPage() {
  const { data: exts } = useQuery({ queryKey: ['extensions'], queryFn: api.extensions });
  const { data: counts } = useQuery({ queryKey: ['voicemail-counts'], queryFn: api.voicemailCounts });

  const vmExts = (exts ?? []).filter((e) => e.voicemail?.enabled);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Voicemail</h1>
        <p className="section-desc">Mailboxes for voicemail-enabled extensions.</p>
      </div>
      <div className="card">
        <div className="card-header"><span className="font-medium">Mailboxes</span><span className="badge">{vmExts.length}</span></div>
        <div className="card-body">
          {vmExts.length === 0 ? (
            <EmptyState title="No voicemail-enabled extensions" hint="Enable voicemail on an extension." />
          ) : (
            <ul className="space-y-2">
              {vmExts.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3">
                  <div>
                    <div className="font-medium">{e.number} — {e.displayName}</div>
                    <div className="text-xs text-[var(--muted)]">
                      PIN configured · messages: {counts?.[e.number] ?? 0}
                    </div>
                  </div>
                  <Link className="btn btn-ghost" to="/extensions">Configure</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
