export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (csrfToken && init.method && !['GET', 'HEAD', 'OPTIONS'].includes(init.method.toUpperCase())) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  const res = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const err = new Error((data as { error?: { message?: string } })?.error?.message ?? res.statusText) as ApiError;
    err.status = res.status;
    const code = (data as { error?: { code?: string } })?.error?.code;
    if (code) err.code = code;
    const details = (data as { error?: { details?: unknown } })?.error?.details;
    if (details !== undefined) err.details = details;
    throw err;
  }
  return data as T;
}

export const api = {
  health: () => apiFetch<{ status: string; version: string }>('/api/health'),
  setupStatus: () => apiFetch<{ setupRequired: boolean; initialized: boolean }>('/api/setup/status'),
  setup: (body: unknown) => apiFetch<{ ok: boolean; csrfToken: string; username: string }>('/api/setup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: unknown) => apiFetch<{ csrfToken: string; user: { id: string; username: string } }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  me: () => apiFetch<{ id: string; username: string; csrfToken: string }>('/api/auth/me'),
  settings: () => apiFetch<unknown>('/api/settings'),
  patchSettings: (body: unknown, etag?: string | null) =>
    apiFetch<{ ok: boolean; commitSha: string; restartRequired: boolean }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: etag ? { 'If-Match': etag } : {},
    }),
  snapshots: () => apiFetch<Array<{ sha: string; shortSha: string; message: string; author: string; date: string }>>('/api/snapshots'),
  snapshot: (sha: string) => apiFetch<{ sha: string; message: string; diff: string }>(`/api/snapshots/${sha}`),
  diff: (sha: string) => apiFetch<{ diff: string }>(`/api/snapshots/${sha}/diff`),
  rollback: (sha: string) => apiFetch<{ ok: boolean; commitSha: string }>(`/api/snapshots/${sha}/rollback`, { method: 'POST' }),
  systemStatus: () => apiFetch<{ version: string; uptimeSeconds: number; setupRequired: boolean; gitHead: string | null }>('/api/system/status'),
  bans: () => apiFetch<Array<{ ip: string; reason: string | null; source: string; createdAt: string; expiresAt: string | null; active: boolean }>>('/api/security/bans'),
  unban: (ip: string) => apiFetch<{ ok: boolean }>(`/api/security/bans/${encodeURIComponent(ip)}`, { method: 'DELETE' }),
  audit: () => apiFetch<Array<{ id: number; createdAt: string; actor: string; action: string; target: string | null; commitSha: string | null }>>('/api/audit'),
  logs: (file: string, tail = 200) => apiFetch<{ lines: string[] }>(`/api/system/logs?file=${encodeURIComponent(file)}&tail=${tail}`),
  extensions: () => apiFetch<Array<{ id: string; number: string; displayName: string; enabled: boolean }>>('/api/extensions'),
  createExtension: (body: unknown) => apiFetch<Record<string, unknown>>('/api/extensions', { method: 'POST', body: JSON.stringify(body) }),
  deleteExtension: (id: string) => apiFetch<{ ok: boolean }>(`/api/extensions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  trunks: () => apiFetch<Array<{ id: string; name: string; host: string; enabled: boolean }>>('/api/trunks'),
  createTrunk: (body: unknown) => apiFetch<Record<string, unknown>>('/api/trunks', { method: 'POST', body: JSON.stringify(body) }),
  deleteTrunk: (id: string) => apiFetch<{ ok: boolean }>(`/api/trunks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  outboundRoutes: () => apiFetch<Array<{ id: string; name: string; priority: number; trunkId: string; enabled: boolean }>>('/api/outbound-routes'),
  createOutboundRoute: (body: unknown) => apiFetch<Record<string, unknown>>('/api/outbound-routes', { method: 'POST', body: JSON.stringify(body) }),
  deleteOutboundRoute: (id: string) => apiFetch<{ ok: boolean }>(`/api/outbound-routes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};