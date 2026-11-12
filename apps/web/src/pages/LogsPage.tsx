import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

type LogFile = 'messages' | 'security' | 'sip';

const FILES: { id: LogFile; label: string }[] = [
  { id: 'messages', label: 'Messages' },
  { id: 'security', label: 'Security' },
  { id: 'sip', label: 'SIP Traces' },
];

export function LogsPage() {
  const [file, setFile] = useState<LogFile>('messages');
  const [tail, setTail] = useState(300);
  const [live, setLive] = useState(true);
  const [lastTraceResult, setLastTraceResult] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['logs', file, tail],
    queryFn: () => api.logs(file, tail),
    refetchInterval: live ? 2000 : false,
  });

  const { data: traceStatus } = useQuery({
    queryKey: ['sip-trace'],
    queryFn: () => api.sipTraceStatus(),
    enabled: file === 'sip',
  });

  const toggleTrace = useMutation({
    mutationFn: (enabled: boolean) => api.sipTraceToggle(enabled),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sip-trace'] });
      if (data?.results) {
        setLastTraceResult(data.results.map((r) => `${r.cmd}: [${r.status}] ${r.output}`).join('\n'));
      }
    },
  });

  const lines = data?.lines ?? [];

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [lines.length, file]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Logs</h1>
          <p className="section-desc">Live log streaming, including SIP traces.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            Live
          </label>
          <select
            className="select" style={{ width: 140 }}
            value={tail}
            onChange={(e) => setTail(Number(e.target.value))}
          >
            <option value={200}>200 lines</option>
            <option value={500}>500 lines</option>
            <option value={1000}>1000 lines</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        {FILES.map((f) => (
          <button
            key={f.id}
            className={`btn ${file === f.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFile(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {file === 'sip' && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-sm">
            <span>SIP tracing: {traceStatus?.enabled ? 'ON' : 'OFF'}</span>
            <button
              className={`btn ${traceStatus?.enabled ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => toggleTrace.mutate(!traceStatus?.enabled)}
              disabled={toggleTrace.isPending}
            >
              {traceStatus?.enabled ? 'Stop trace' : 'Start trace'}
            </button>
            <span className="text-[var(--muted)]">
              Enables the PJSIP logger; live traces stream below. Disable when finished to avoid logging secrets.
            </span>
          </div>
          {lastTraceResult && (
            <pre className="max-h-40 overflow-auto rounded border border-[var(--border)] bg-[var(--panel-2)] p-2 text-xs text-[var(--text)]">
              {lastTraceResult}
            </pre>
          )}
        </>
      )}

      <pre
        ref={preRef}
        className="max-h-[70vh] overflow-auto rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs whitespace-pre-wrap"
      >
        {lines.join('\n')}
      </pre>
    </div>
  );
}