import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setCsrfToken } from '../lib/api';
import { useAuth } from '../lib/auth';

export function SetupPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [setupCode, setSetupCode] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.setup({ setupCode, username, password });
      setCsrfToken(res.csrfToken);
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'setup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-2xl font-semibold">Initial setup</h1>
        <p className="text-sm text-slate-400">Enter the one-time setup code from the container logs.</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <label className="block">
          <span className="text-sm">Setup code</span>
          <input className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2" value={setupCode} onChange={(e) => setSetupCode(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm">Admin username</span>
          <input className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm">Admin password</span>
          <input type="password" className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button disabled={loading} className="w-full rounded bg-emerald-600 px-3 py-2 font-medium hover:bg-emerald-500 disabled:opacity-50">
          {loading ? 'Setting up…' : 'Complete setup'}
        </button>
      </form>
    </main>
  );
}