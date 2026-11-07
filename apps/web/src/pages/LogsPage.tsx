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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sip-trace'] }),
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
        <h1 className="text-2xl font-semibold">Logs</h1>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            Live
          </label>
          <select
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1"
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
            className={`rounded px-3 py-1 ${file === f.id ? 'bg-emerald-600 text-white' : 'bg-slate-800'}`}
            onClick={() => setFile(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {file === 'sip' && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-slate-800 bg-slate-900/50 p-3 text-sm">
          <span>SIP tracing: {traceStatus?.enabled ? 'ON' : 'OFF'}</span>
          <button
            className={`rounded px-3 py-1 ${traceStatus?.enabled ? 'bg-rose-600' : 'bg-emerald-600'} text-white`}
            onClick={() => toggleTrace.mutate(!traceStatus?.enabled)}
            disabled={toggleTrace.isPending}
          >
            {traceStatus?.enabled ? 'Stop trace' : 'Start trace'}
          </button>
          <span className="text-slate-400">
            Enables the PJSIP logger; live traces stream below. Disable when finished to avoid logging secrets.
          </span>
        </div>
      )}

      <pre
        ref={preRef}
        className="max-h-[70vh] overflow-auto rounded border border-slate-800 bg-slate-900 p-3 text-xs whitespace-pre-wrap"
      >
        {lines.join('\n')}
      </pre>
    </div>
  );
}