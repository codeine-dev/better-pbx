import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Settings } from '@better-pbx/shared';
import { COUNTRIES } from '@better-pbx/shared';
import { api } from '../lib/api';

export function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const { data: mcp } = useQuery({ queryKey: ['mcp-status'], queryFn: api.mcpStatus });
  const [form, setForm] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('no settings');
      return api.patchSettings(form);
    },
    onSuccess: () => {
      setError(null);
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  if (!form) return <div className="text-[var(--muted)]">Loading…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
          Saved.
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Region</span>
        </div>
        <div className="card-body grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="country">
              Country
            </label>
            <select
              id="country"
              className="select"
              value={form.region.country}
              onChange={(e) =>
                setForm({ ...form, region: { ...form.region, country: e.target.value } })
              }
            >
              {!COUNTRIES.some((c) => c.code === form.region.country) && (
                <option value={form.region.country}>{form.region.country}</option>
              )}
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Timezone</label>
            <input
              className="input"
              value={form.region.timezone}
              onChange={(e) =>
                setForm({ ...form, region: { ...form.region, timezone: e.target.value } })
              }
            />
          </div>
          <div>
            <label className="label">Language</label>
            <input
              className="input"
              value={form.region.language}
              onChange={(e) =>
                setForm({ ...form, region: { ...form.region, language: e.target.value } })
              }
            />
          </div>
          <div>
            <label className="label">Emergency numbers (comma)</label>
            <input
              className="input"
              value={form.region.emergencyNumbers.join(',')}
              onChange={(e) =>
                setForm({
                  ...form,
                  region: {
                    ...form.region,
                    emergencyNumbers: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Network</span>
        </div>
        <div className="card-body grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">External address</label>
            <input
              className="input"
              value={form.network.externalAddress ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  network: { ...form.network, externalAddress: e.target.value || null },
                })
              }
            />
          </div>
          <div>
            <label className="label">Local networks (comma)</label>
            <input
              className="input"
              value={form.network.localNetworks.join(',')}
              onChange={(e) =>
                setForm({
                  ...form,
                  network: {
                    ...form.network,
                    localNetworks: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </div>
          <div>
            <label className="label">SIP port</label>
            <input
              type="number"
              className="input"
              value={form.network.sipPort}
              onChange={(e) =>
                setForm({ ...form, network: { ...form.network, sipPort: Number(e.target.value) } })
              }
            />
          </div>
          <div>
            <label className="label">TLS port</label>
            <input
              type="number"
              className="input"
              value={form.network.tlsPort}
              onChange={(e) =>
                setForm({ ...form, network: { ...form.network, tlsPort: Number(e.target.value) } })
              }
            />
          </div>
          <div>
            <label className="label">RTP start</label>
            <input
              type="number"
              className="input"
              value={form.network.rtpStart}
              onChange={(e) =>
                setForm({ ...form, network: { ...form.network, rtpStart: Number(e.target.value) } })
              }
            />
          </div>
          <div>
            <label className="label">RTP end</label>
            <input
              type="number"
              className="input"
              value={form.network.rtpEnd}
              onChange={(e) =>
                setForm({ ...form, network: { ...form.network, rtpEnd: Number(e.target.value) } })
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.network.tlsEnabled}
              onChange={(e) =>
                setForm({ ...form, network: { ...form.network, tlsEnabled: e.target.checked } })
              }
            />{' '}
            TLS enabled
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Security</span>
        </div>
        <div className="card-body grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Max retry</label>
            <input
              type="number"
              className="input"
              value={form.security.fail2ban.maxRetry}
              onChange={(e) =>
                setForm({
                  ...form,
                  security: {
                    ...form.security,
                    fail2ban: { ...form.security.fail2ban, maxRetry: Number(e.target.value) },
                  },
                })
              }
            />
          </div>
          <div>
            <label className="label">Find time (s)</label>
            <input
              type="number"
              className="input"
              value={form.security.fail2ban.findTime}
              onChange={(e) =>
                setForm({
                  ...form,
                  security: {
                    ...form.security,
                    fail2ban: { ...form.security.fail2ban, findTime: Number(e.target.value) },
                  },
                })
              }
            />
          </div>
          <div>
            <label className="label">Ban time (s)</label>
            <input
              type="number"
              className="input"
              value={form.security.fail2ban.banTime}
              onChange={(e) =>
                setForm({
                  ...form,
                  security: {
                    ...form.security,
                    fail2ban: { ...form.security.fail2ban, banTime: Number(e.target.value) },
                  },
                })
              }
            />
          </div>
          <div>
            <label className="label">Whitelist (comma)</label>
            <input
              className="input"
              value={form.security.whitelist.join(',')}
              onChange={(e) =>
                setForm({
                  ...form,
                  security: {
                    ...form.security,
                    whitelist: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </div>
          <div>
            <label className="label">Blacklist (comma)</label>
            <input
              className="input"
              value={form.security.blacklist.join(',')}
              onChange={(e) =>
                setForm({
                  ...form,
                  security: {
                    ...form.security,
                    blacklist: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Voicemail</span>
        </div>
        <div className="card-body grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Max messages</label>
            <input
              type="number"
              className="input"
              value={form.voicemail.maxMessages}
              onChange={(e) =>
                setForm({
                  ...form,
                  voicemail: { ...form.voicemail, maxMessages: Number(e.target.value) },
                })
              }
            />
          </div>
          <div>
            <label className="label">Max seconds</label>
            <input
              type="number"
              className="input"
              value={form.voicemail.maxSeconds}
              onChange={(e) =>
                setForm({
                  ...form,
                  voicemail: { ...form.voicemail, maxSeconds: Number(e.target.value) },
                })
              }
            />
          </div>
          <div>
            <label className="label">Default PIN length</label>
            <input
              type="number"
              className="input"
              value={form.voicemail.defaultPinLength}
              onChange={(e) =>
                setForm({
                  ...form,
                  voicemail: { ...form.voicemail, defaultPinLength: Number(e.target.value) },
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-medium">Model Context Protocol (MCP)</span>
        </div>
        <div className="card-body space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.mcp?.enabled ?? true}
              onChange={(e) => setForm({ ...form, mcp: { enabled: e.target.checked } })}
            />
            Enable MCP server
          </label>
          <p className="text-xs text-[var(--muted)]">
            Endpoint:{' '}
            <code>
              {window.location.origin}
              {mcp?.path ?? '/mcp'}
            </code>
          </p>
          <p className="text-xs text-[var(--muted)]">
            Token: <code className="break-all">{mcp?.token ?? 'loading…'}</code>
          </p>
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium">Claude Desktop</div>
              <pre className="mt-1 overflow-auto rounded bg-black/30 p-2 text-xs">
                {JSON.stringify(
                  {
                    mcpServers: {
                      'better-pbx': {
                        url: `${window.location.origin}${mcp?.path ?? '/mcp'}`,
                        headers: { Authorization: `Bearer ${mcp?.token ?? '<token>'}` },
                      },
                    },
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
            <div>
              <div className="font-medium">OpenAI (Codex / Agents)</div>
              <pre className="mt-1 overflow-auto rounded bg-black/30 p-2 text-xs">{`# Add to your MCP client config
url: ${window.location.origin}${mcp?.path ?? '/mcp'}
transport: streamable-http
headers:
  Authorization: Bearer ${mcp?.token ?? '<token>'}`}</pre>
            </div>
            <div>
              <div className="font-medium">OpenCode</div>
              <pre className="mt-1 overflow-auto rounded bg-black/30 p-2 text-xs">
                {JSON.stringify(
                  {
                    mcp: {
                      'better-pbx': {
                        type: 'remote',
                        url: `${window.location.origin}${mcp?.path ?? '/mcp'}`,
                        headers: { Authorization: `Bearer ${mcp?.token ?? '<token>'}` },
                      },
                    },
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary"
        disabled={save.isPending}
        onClick={() => {
          setSaved(false);
          save.mutate();
        }}
      >
        Save settings
      </button>
    </div>
  );
}
