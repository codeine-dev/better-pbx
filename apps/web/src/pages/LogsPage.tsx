import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export function LogsPage() {
  const [file, setFile] = useState<'messages' | 'security'>('messages');
  const { data } = useQuery({ queryKey: ['logs', file], queryFn: () => api.logs(file, 200) });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Logs</h1>
      <div className="flex gap-2">
        <button className={`rounded px-3 py-1 ${file === 'messages' ? 'bg-emerald-600' : 'bg-slate-800'}`} onClick={() => setFile('messages')}>Messages</button>
        <button className={`rounded px-3 py-1 ${file === 'security' ? 'bg-emerald-600' : 'bg-slate-800'}`} onClick={() => setFile('security')}>Security</button>
      </div>
      <pre className="max-h-96 overflow-auto rounded border border-slate-800 bg-slate-900 p-3 text-xs">{(data?.lines ?? []).join('\\n')}</pre>
    </div>
  );
}