import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setCsrfToken } from '../lib/api';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ username, password });
      setCsrfToken(res.csrfToken);
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <label className="block">
          <span className="text-sm">Username</span>
          <input className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm">Password</span>
          <input type="password" className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button disabled={loading} className="w-full rounded bg-emerald-600 px-3 py-2 font-medium hover:bg-emerald-500 disabled:opacity-50">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}