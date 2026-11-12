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
    <main className="grid min-h-screen place-items-center bg-[var(--bg)] px-6 text-[var(--text)]">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-8 shadow-lg">
        <div className="mb-2 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-white font-extrabold">P</div>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text-strong)]">BetterPBX</h1>
            <p className="text-xs font-semibold text-[var(--muted)]">Sign in to the console</p>
          </div>
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <label className="block space-y-1">
          <span className="label">Username</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="label">Password</span>
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button disabled={loading} className="btn btn-primary w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}