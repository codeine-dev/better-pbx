import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Settings } from '@better-pbx/shared';
import { COUNTRIES } from '@better-pbx/shared';
import { api } from '../lib/api';

export function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const { data: mcp } = useQuery({ queryKey: ['mcp-status'], queryFn: api.mcpStatus });
  const { data: tls, refetch: refetchTls } = useQuery({ queryKey: ['tls-status'], queryFn: api.tlsStatus });
  const { data: tlsCert, refetch: refetchTlsCert } = useQuery({ queryKey: ['tls-cert'], queryFn: api.tlsCertificate, enabled: !!tls?.hasCert });
  const [form, setForm] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [certPem, setCertPem] = useState('');
  const [keyPem, setKeyPem] = useState('');
  const [acmeChallenge, setAcmeChallenge] = useState('http-01');
  const [acmeDomain, setAcmeDomain] = useState('');
  const [acmeEmail, setAcmeEmail] = useState('');
  const [acmeDnsProvider, setAcmeDnsProvider] = useState('');
  const [acmeCredentials, setAcmeCredentials] = useState('');
  const [tlsMsg, setTlsMsg] = useState<string | null>(null);
  const [tlsValidation, setTlsValidation] = useState<Record<string, unknown> | null>(null);


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

          <div>
            <label className="label">TLS method</label>
            <select
              className="select"
              value={form.network.tlsMethod}
              onChange={(e) =>
                setForm({ ...form, network: { ...form.network, tlsMethod: e.target.value } })
              }
            >
              <option value="">Default</option>
              <option value="tlsv1">TLS 1.0</option>
              <option value="tlsv1_1">TLS 1.1</option>
              <option value="tlsv1_2">TLS 1.2</option>
              <option value="tlsv1_3">TLS 1.3</option>
            </select>
          </div>
          <div>
            <label className="label">TLS cipher (optional)</label>
            <input
              className="input"
              value={form.network.tlsCipher}
              onChange={(e) =>
                setForm({ ...form, network: { ...form.network, tlsCipher: e.target.value } })
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.network.srtpEnabled}
              onChange={(e) =>
                setForm({ ...form, network: { ...form.network, srtpEnabled: e.target.checked } })
              }
            />{' '}
            SRTP (media encryption) enabled
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.network.dtlsSrtpEnabled}
              onChange={(e) =>
                setForm({ ...form, network: { ...form.network, dtlsSrtpEnabled: e.target.checked } })
              }
            />{' '}
            DTLS-SRTP (media encryption) enabled
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

      <div className="card">
        <div className="card-header">
          <span className="font-medium">TLS certificate</span>
        </div>
        <div className="card-body space-y-4">
          {tlsMsg && <div className="text-sm text-[var(--muted)]">{tlsMsg}</div>}
          <div className="text-sm text-[var(--muted)]">
            Source: {String(tls?.source ?? 'unknown')} · Cert: {tls?.hasCert ? 'present' : 'missing'} · Key: {tls?.hasKey ? 'present' : 'missing'}
            {tls?.cert ? ` · expires ${String((tls.cert as Record<string, unknown>).validTo)}` : ''}
          </div>
          {tlsCert?.cert && (
            <div className="space-y-2">
              <label className="label">Certificate (PEM) — share with softphones</label>
              <textarea className="input font-mono text-xs" rows={8} readOnly value={tlsCert.cert} />
              <div className="flex gap-2">
                <button
                  className="btn"
                  onClick={() => {
                    navigator.clipboard?.writeText(tlsCert.cert);
                    setTlsMsg('Copied certificate to clipboard.');
                  }}
                >
                  Copy
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    const blob = new Blob([tlsCert.cert], { type: 'application/x-pem-file' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'better-pbx-cert.pem';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button className="btn" onClick={async () => { setTlsMsg(null); try { await api.tlsSelfSigned(); await refetchTls(); await refetchTlsCert(); setTlsMsg('Self-signed certificate generated.'); } catch (e) { setTlsMsg(e instanceof Error ? e.message : 'Failed'); } }}>Generate self-signed</button>
            <button className="btn" onClick={async () => { setTlsMsg(null); try { await api.tlsRenew(); await refetchTls(); setTlsMsg('Renewal attempted.'); } catch (e) { setTlsMsg(e instanceof Error ? e.message : 'Failed'); } }}>Renew (ACME)</button>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={async () => { setTlsMsg(null); try { const r = await api.tlsValidate(); setTlsValidation(r); setTlsMsg('Validation complete.'); } catch (e) { setTlsMsg(e instanceof Error ? e.message : 'Failed'); } }}>Validate SIPS/SRTP</button>
          </div>
          {tlsValidation && (
            <pre className="mt-2 overflow-auto rounded bg-black/30 p-2 text-xs">
              {JSON.stringify(tlsValidation, null, 2)}
            </pre>
          )}

          <div className="space-y-2">
            <label className="label">Certificate PEM</label>
            <textarea className="input" rows={4} value={certPem} onChange={(e) => setCertPem(e.target.value)} />
            <label className="label">Private key PEM</label>
            <textarea className="input" rows={4} value={keyPem} onChange={(e) => setKeyPem(e.target.value)} />
            <button className="btn" onClick={async () => { setTlsMsg(null); try { await api.tlsUploadCert({ cert: certPem, key: keyPem }); await refetchTls(); await refetchTlsCert(); setTlsMsg('Certificate installed.'); } catch (e) { setTlsMsg(e instanceof Error ? e.message : 'Failed'); } }}>Install manual certificate</button>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-sm">ACME (Let's Encrypt)</div>
            <select className="select" value={acmeChallenge} onChange={(e) => setAcmeChallenge(e.target.value)}>
              <option value="http-01">HTTP-01</option>
              <option value="dns-01">DNS-01</option>
            </select>
            <input className="input" placeholder="Domain" value={acmeDomain} onChange={(e) => setAcmeDomain(e.target.value)} />
            <input className="input" placeholder="Email" value={acmeEmail} onChange={(e) => setAcmeEmail(e.target.value)} />
            {acmeChallenge === 'dns-01' && (
              <>
                <input className="input" placeholder="DNS provider (e.g. cloudflare)" value={acmeDnsProvider} onChange={(e) => setAcmeDnsProvider(e.target.value)} />
                <textarea className="input" rows={4} placeholder="Credentials ini" value={acmeCredentials} onChange={(e) => setAcmeCredentials(e.target.value)} />
              </>
            )}
            <button className="btn" onClick={async () => { setTlsMsg(null); try { await api.tlsAcme({ challenge: acmeChallenge, domain: acmeDomain, email: acmeEmail, dnsProvider: acmeDnsProvider, credentials: acmeCredentials }); await refetchTls(); await refetchTlsCert(); setTlsMsg('ACME certificate acquired.'); } catch (e) { setTlsMsg(e instanceof Error ? e.message : 'Failed'); } }}>Acquire via ACME</button>
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
