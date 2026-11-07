import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export function VoicemailPage() {
  const { data: exts } = useQuery({ queryKey: ['extensions'], queryFn: api.extensions });
  const { data: counts } = useQuery({ queryKey: ['voicemail-counts'], queryFn: api.voicemailCounts });

  const vmExts = (exts ?? []).filter((e) => e.voicemail?.enabled);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Voicemail</h1>
      <div className="card">
        <div className="card-header"><span className="font-medium">Mailboxes</span><span className="badge">{vmExts.length}</span></div>
        <div className="card-body">
          {vmExts.length === 0 ? (
            <div className="empty">No voicemail-enabled extensions. Enable voicemail on an extension.</div>
          ) : (
            <ul className="space-y-2">
              {vmExts.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border)] bg-black/20 p-3">
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
