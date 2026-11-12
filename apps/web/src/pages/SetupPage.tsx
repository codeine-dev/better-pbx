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
    <main className="grid min-h-screen place-items-center bg-[var(--bg)] px-6 text-[var(--text)]">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-8 shadow-lg">
        <div className="mb-2 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-white font-extrabold">P</div>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text-strong)]">Initial setup</h1>
            <p className="text-xs font-semibold text-[var(--muted)]">One-time setup code from container logs</p>
          </div>
        </div>
        <p className="text-sm text-[var(--muted)]">Enter the one-time setup code from the container logs.</p>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <label className="block space-y-1">
          <span className="label">Setup code</span>
          <input className="input" value={setupCode} onChange={(e) => setSetupCode(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="label">Admin username</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="label">Admin password</span>
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button disabled={loading} className="btn btn-primary w-full">
          {loading ? 'Setting up…' : 'Complete setup'}
        </button>
      </form>
    </main>
  );
}