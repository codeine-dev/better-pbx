import type {
  Destination,
  Extension,
  InboundRoute,
  Ivr,
  IvrOption,
  OutboundPattern,
  OutboundRoute,
  Prompt,
  RingGroup,
  Settings,
  Trunk,
} from '@better-pbx/shared';

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

type Patch<T> = Partial<T>;

export const api = {
  health: () => apiFetch<{ status: string; version: string }>('/api/health'),
  setupStatus: () => apiFetch<{ setupRequired: boolean; initialized: boolean }>('/api/setup/status'),
  setup: (body: unknown) => apiFetch<{ ok: boolean; csrfToken: string; username: string }>('/api/setup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: unknown) => apiFetch<{ csrfToken: string; user: { id: string; username: string } }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  me: () => apiFetch<{ id: string; username: string; csrfToken: string }>('/api/auth/me'),
  settings: () => apiFetch<Settings>('/api/settings'),
  patchSettings: (body: Patch<Settings>, etag?: string | null) =>
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
  sipTraceStatus: () => apiFetch<{ enabled: boolean }>('/api/system/sip-trace'),
  sipTraceToggle: (enabled: boolean) =>
    apiFetch<{ enabled: boolean }>('/api/system/sip-trace', { method: 'POST', body: JSON.stringify({ enabled }) }),
  voicemailCounts: () => apiFetch<Record<string, number>>('/api/voicemail/counts'),

  extensions: () => apiFetch<Array<Omit<Extension, 'secret'>>>('/api/extensions'),
  createExtension: (body: unknown) => apiFetch<Extension & { secret?: string }>('/api/extensions', { method: 'POST', body: JSON.stringify(body) }),
  patchExtension: (id: string, body: unknown) => apiFetch<Extension & { secret?: string }>(`/api/extensions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteExtension: (id: string) => apiFetch<{ ok: boolean }>(`/api/extensions/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  trunks: () => apiFetch<Array<Omit<Trunk, 'password'>>>('/api/trunks'),
  createTrunk: (body: unknown) => apiFetch<Trunk>(`/api/trunks`, { method: 'POST', body: JSON.stringify(body) }),
  patchTrunk: (id: string, body: unknown) => apiFetch<Trunk>(`/api/trunks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTrunk: (id: string) => apiFetch<{ ok: boolean }>(`/api/trunks/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  outboundRoutes: () => apiFetch<OutboundRoute[]>('/api/outbound-routes'),
  createOutboundRoute: (body: unknown) => apiFetch<OutboundRoute>('/api/outbound-routes', { method: 'POST', body: JSON.stringify(body) }),
  patchOutboundRoute: (id: string, body: unknown) => apiFetch<OutboundRoute>(`/api/outbound-routes/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteOutboundRoute: (id: string) => apiFetch<{ ok: boolean }>(`/api/outbound-routes/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  inboundRoutes: () => apiFetch<InboundRoute[]>('/api/inbound-routes'),
  createInboundRoute: (body: unknown) => apiFetch<InboundRoute>('/api/inbound-routes', { method: 'POST', body: JSON.stringify(body) }),
  patchInboundRoute: (id: string, body: unknown) => apiFetch<InboundRoute>(`/api/inbound-routes/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteInboundRoute: (id: string) => apiFetch<{ ok: boolean }>(`/api/inbound-routes/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  ringGroups: () => apiFetch<RingGroup[]>('/api/ring-groups'),
  createRingGroup: (body: unknown) => apiFetch<RingGroup>('/api/ring-groups', { method: 'POST', body: JSON.stringify(body) }),
  patchRingGroup: (id: string, body: unknown) => apiFetch<RingGroup>(`/api/ring-groups/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRingGroup: (id: string) => apiFetch<{ ok: boolean }>(`/api/ring-groups/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  ivrs: () => apiFetch<Ivr[]>('/api/ivrs'),
  createIvr: (body: unknown) => apiFetch<Ivr>('/api/ivrs', { method: 'POST', body: JSON.stringify(body) }),
  patchIvr: (id: string, body: unknown) => apiFetch<Ivr>(`/api/ivrs/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteIvr: (id: string) => apiFetch<{ ok: boolean }>(`/api/ivrs/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  prompts: () => apiFetch<Prompt[]>('/api/prompts'),
  createPrompt: (body: unknown) => apiFetch<Prompt>('/api/prompts', { method: 'POST', body: JSON.stringify(body) }),
  uploadPrompt: (body: unknown) => apiFetch<Prompt>('/api/prompts/upload', { method: 'POST', body: JSON.stringify(body) }),
  deletePrompt: (id: string) => apiFetch<{ ok: boolean }>(`/api/prompts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export type { Destination, IvrOption, OutboundPattern };
