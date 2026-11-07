# BetterPBX — Implementation Plan

Status: proposed, ready to execute unattended.
Target: a single Docker image that runs Asterisk 22 LTS, a hardened configuration API, and a React admin UI.

---

## 1. Goal

Deliver a self-contained PBX appliance:

```sh
docker run --network=host -v better-pbx:/data better-pbx:latest
```

- Asterisk 22 LTS as the telephony engine.
- React + TypeScript admin UI.
- REST API that owns the PBX configuration.
- Every change snapshotted as a Git commit, with diff and rollback.
- Initial setup wizard, forced on an empty `/data`.
- VoIP security hardened by default: fail2ban, whitelist/blacklist, safe dialplan generation, no anonymous SIP.
- Voicemail persisted at `/data/voicemail` (the whole state lives in `/data`).
- Features: extensions, trunks, outbound routes, inbound routes, IVRs, voicemail, ring groups.

## 2. Key Decisions

These are the decisions I will implement unless told otherwise. Each is chosen to make the project implementable and testable unattended.

### 2.1 Asterisk 22 LTS, built from source

Asterisk 22 is the current LTS (full support to Oct 2028, security to Oct 2029). Build from source on Debian 13 (trixie) with bundled pjproject and jansson. This avoids distro packaging drift and lets us pin the exact release and compile only the modules we need. Pin the build with `ARG ASTERISK_VERSION=22.11.0` (bump to the latest 22.x at implementation time) and verify its SHA-256.

Alternatives considered: Debian's Asterisk package (less control, packaging bugs reported), Asterisk 24 (too new for production), FreeSWITCH (PROJECT specifies Asterisk).

### 2.2 Typed configuration model + renderer, not raw file editing

The source of truth is a versioned YAML document (`/data/config/pbx.yaml`). The API validates it with Zod and renders the complete `/data/config/asterisk/*` tree. `/etc/asterisk` is a symlink to that tree. The API never exposes editable raw config.

Why:

- The UI can only produce valid, hardened config.
- Rendering is deterministic, so diffs and snapshots are meaningful.
- No lossy parsing/serialising of Asterisk `.conf` files.
- Rollback restores the model and re-renders, not just stale text files.

A read-only raw config viewer/download will be included for transparency.

Alternatives considered: Asterisk realtime via ODBC (more moving parts, harder to snapshot), editing `.conf` directly (unsafe, hard to validate), `astdb` as source of truth (not reviewable).

### 2.3 Git snapshots of model + rendered output

`/data/config` is a Git repository. Every successful mutation:

1. Validates the proposed model.
2. Renders to a staging tree.
3. Runs security checks and (for structural changes) a throwaway Asterisk config check.
4. Writes the files.
5. Reloads Asterisk.
6. Commits the model and rendered files, with the admin and change description.

Rollback restores the model from a chosen commit, re-renders, reloads, and creates a new commit (`Rollback to abc123`). History is never rewritten. Secrets are necessarily present in the rendered/config model; `/data` is root/admin-only and this is documented.

### 2.4 Single image, multiple supervised processes

The image uses `s6-overlay` as PID 1 and supervises:

- `asterisk` (runs as `asterisk:pbx`)
- `better-pbx-api` (runs as `pbx:pbx`)
- `fail2ban` (runs as root, but the default ban action is a local API call — no `NET_ADMIN` required)

A one-shot init service creates `/data`, fixes ownership, generates self-signed SIP TLS material, initialises Git, and writes the bootstrap model before the other services start.

### 2.5 Node/TypeScript end to end

- API: Fastify 5, Zod, better-sqlite3.
- UI: React 19, Vite 7, TypeScript, Tailwind 4, shadcn/ui, TanStack Query, React Hook Form.
- Monorepo: pnpm workspaces. Shared Zod schemas used by both API and UI.
- Config engine: a pure TypeScript package with no I/O, tested with golden files.

This gives one language, one validation layer, and fast unattended iteration.

### 2.6 Security is enforced in the model and renderer

The API and UI reject unsafe choices; the renderer additionally runs a security policy over every generated config. Examples:

- Every endpoint must authenticate; no anonymous endpoint.
- Trunks must use registration auth or a specific provider IP/CIDR (never `0.0.0.0/0`).
- Outbound routes cannot be catch-all (`_.`, `_X.`, `_!`) unless explicitly allowed with a one-time confirmation, and are rejected by default.
- Premium-rate and high-risk prefixes are blocked by default; the user can opt in per route.
- Codecs are limited to ulaw/alaw/gsm/g722.
- PJSIP identifiers exclude `anonymous`; unidentified-request thresholds generate security events.
- AMI, ARI, and Asterisk's internal HTTP server are disabled.
- Dangerous modules (`app_system`, `app_exec`, `app_disa`, legacy channel drivers) are not loaded.
- Fail2ban cannot be disabled from the UI.
- Whitelist and blacklist are CIDR-validated, mutually exclusive per address, and applied to both fail2ban and the PJSIP ACL.

### 2.7 Fail2ban without requiring extra capabilities

`fail2ban` watches Asterisk's structured `security` log. Its ban action calls a local helper (`pbx-ban`) which POSTs to the API over loopback with a one-time internal token. The API records the ban, regenerates the global PJSIP ACL (`[acl] type=acl` in a runtime include), and reloads PJSIP.

This blocks offending IPs at the SIP layer even when the container has no `NET_ADMIN`. If the operator adds `--cap-add=NET_ADMIN` and enables firewall bans, the same action also adds an nftables rule; this is optional. Native fail2ban `iptables` action is not required.

Whitelist entries go into fail2ban `ignoreip` and the ACL permit list. Manual blacklist entries are permanent ACL denies. Automatic bans expire; the API also sweeps expired bans in case a fail2ban unban callback is missed.

### 2.8 Setup anti-hijack token

On an empty volume the API is reachable before an admin exists. To prevent a remote party from claiming the PBX, first-run setup requires a one-time code printed to container logs (`docker logs better-pbx`) and stored at `/data/setup-token`. It is invalidated after setup. `PBX_SETUP_TOKEN` can override it for automated provisioning. This is the only mandatory secret in the wizard; everything else has defaults.

### 2.9 Regional defaults

The wizard preselects country, timezone, language, emergency numbers, and dial prefixes from the browser locale and server timezone. The user can accept all defaults. Country selection drives `indications.conf` tones and emergency-number defaults; language selection drives installed Asterisk sound packs and channel language.

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Docker container (host network)                             │
│                                                             │
│  s6-overlay                                                 │
│   ├── init (one-shot: dirs, ownership, TLS, git, bootstrap) │
│   ├── better-pbx-api :8080  (Fastify + static React SPA)     │
│   ├── asterisk       :5060/5061, RTP 10000-20000            │
│   └── fail2ban       (polls /data/log/security)             │
│                                                             │
│  /data                                                      │
│   ├── config/            Git repo                           │
│   │   ├── pbx.yaml       source of truth                    │
│   │   └── asterisk/      rendered config                    │
│   ├── voicemail/         Asterisk voicemail spool           │
│   ├── sounds/            uploaded IVR prompts               │
│   ├── runtime/           ACL bans, tokens, pid/ctl sockets  │
│   ├── log/               messages, security, CDR            │
│   ├── fail2ban/          fail2ban state                     │
│   └── pbx.db             users, sessions, audit, CDR index  │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Data model (sketch)

```yaml
schemaVersion: 1
meta: { pbxName, createdAt, updatedAt }
settings:
  region:   { country, timezone, language, emergencyNumbers,
              nationalPrefix, internationalPrefix, outsidePrefix }
  network:  { externalAddress, localNetworks[], sipPort, tlsPort,
              rtpStart, rtpEnd, tlsEnabled }
  security: { fail2ban: { maxRetry, findTime, banTime, increment },
              whitelist: [cidr], blacklist: [cidr] }
  voicemail:{ maxMessages, maxSeconds, defaultPinLength }
extensions: [
  { id, number, displayName, secret, codecs[], enabled,
    voicemail: { enabled, pin, email? }, callerId,
    transport: udp|tls, maxContacts, remotePhone }
]
trunks: [
  { id, name, host, port, transport, username?, password?,
    fromUser?, fromDomain?, callerId, codecs[],
    inboundMode: registration|ip, providerCidrs[], enabled }
]
outboundRoutes: [
  { id, name, priority, trunkId, patterns: [{ match, strip, prepend }],
    callerId?, allowPremium, enabled }
]
inboundRoutes: [
  { id, name, did, trunkId?, destination, callerIdFilter?, enabled }
]
ringGroups: [
  { id, name, number, strategy, memberIds[], ringTime,
    destinationIfNoAnswer }
]
ivrs: [
  { id, name, number?, greetingPromptId, timeoutSeconds, maxRetries,
    options: [{ digit, destination }], timeoutDestination,
    invalidDestination?, directDial }
]
prompts: [
  { id, name, kind: builtin|custom, file, originalName, durationMs }
]
```

Destinations are a discriminated union: `extension`, `ringGroup`, `ivr`, `voicemail`, `hangup`. Validation resolves every reference and rejects cycles (e.g. IVR A -> IVR B -> IVR A).

### 3.2 Asterisk files rendered

- `asterisk.conf` — all state directories under `/data` (`astspooldir=/data`, so voicemail is `/data/voicemail`).
- `pjsip.conf` — global, UDP/TLS transports, endpoints, auths, AORs, trunk registrations/identifies, and a runtime ACL include.
- `extensions.conf` — internal extensions, feature codes, outbound routes, inbound routes, ring-group and IVR contexts.
- `queues.conf` — one queue per ring group (supports ringall/linear/rrmemory).
- `voicemail.conf` — one mailbox per voicemail-enabled extension.
- `logger.conf` — console, messages, and the structured `security` log fail2ban reads.
- `rtp.conf`, `indications.conf`, `features.conf`, `modules.conf`, `cdr.conf`, `musiconhold.conf`.
- `fail2ban/` — jail, filter, and custom action.

Runtime-only files (automatic bans) live in `/data/runtime` and are not committed; they are regenerated from the model + ban store.

### 3.3 Apply pipeline

```
mutate model
  -> Zod + cross-resource validation
  -> security policy checks
  -> render staging tree
  -> structural check (temp Asterisk instance on alternate ports for
     changes that can affect startup)
  -> atomic write
  -> reload: dialplan / pjsip / voicemail / queues / logger / fail2ban
  -> git commit (model + rendered)
  -> audit log
```

Changes that cannot be reloaded (transport binds, RTP range, modules, directory layout) are classified as `restartRequired`. The API restarts Asterisk only when there are no active calls; otherwise it returns a pending-apply state and the UI offers "apply when idle".

A failed reload leaves the previous commit checked out, restores the previous rendered files, and reports the Asterisk error. A failed commit after a successful reload is reverted with a corrective commit.

### 3.4 API surface (v1)

```
GET    /api/health
GET    /api/setup/status
POST   /api/setup
POST   /api/auth/login | /api/auth/logout
GET    /api/auth/me
POST   /api/auth/password

GET/POST/PATCH/DELETE  /api/extensions
GET/POST/PATCH/DELETE  /api/trunks
GET/POST/PATCH/DELETE  /api/outbound-routes
GET/POST/PATCH/DELETE  /api/inbound-routes
GET/POST/PATCH/DELETE  /api/ring-groups
GET/POST/PATCH/DELETE  /api/ivrs
GET/POST/DELETE        /api/prompts
GET/PATCH              /api/settings

GET    /api/snapshots
GET    /api/snapshots/:sha
GET    /api/snapshots/:sha/diff
POST   /api/snapshots/:sha/rollback

GET    /api/system/status
GET    /api/system/registrations
GET    /api/system/calls
GET    /api/system/cdr
GET    /api/system/logs
GET    /api/system/config (read-only rendered files)
POST   /api/system/apply-pending

GET    /api/security/bans
DELETE /api/security/bans/:ip
GET    /api/security/status

POST   /internal/bans        (loopback + internal token, fail2ban only)

POST   /mcp, /api/mcp        (MCP Streamable HTTP, JSON-RPC over SSE; agents)
```

Conventions: JSON, camelCase, Zod-validated bodies, ETag/`If-Match` on mutations, `409` on stale writes, structured errors, OpenAPI docs at `/api/docs`.

### 3.4.1 Model Context Protocol (MCP) endpoint

The API exposes an MCP server at `/mcp` and `/api/mcp` using the Streamable HTTP transport (JSON-RPC over SSE, stateless mode). It lets external agents (e.g. OpenCode) inspect and, when authorised, configure the PBX through typed tools instead of raw REST calls. Tools cover health/status, model summaries, extensions/trunks/routes/ring groups/IVRs, settings, snapshots and diffs, logs, CDR, bans, audit, rendered config (read-only), and create/update/delete operations that reuse the same validation, security policy, apply pipeline, Git snapshot, and audit logging as the REST API. Authentication uses a generated token stored at `/data/runtime/mcp-token` (mode 0600): requests from loopback are allowed without a token, remote requests require `Authorization: Bearer <token>` (or `X-MCP-Token`). The endpoint is exempt from the setup gate so agents can report setup status; mutating tools return `setup required` until setup completes. Security invariants are unchanged: every mutation still passes Zod validation, security policy, render + apply, and is snapshotted as a Git commit.

### 3.5 Auth and API hardening

- Single admin role in v1 (schema supports more users later); Argon2id password hashes.
- Opaque session token in an HttpOnly, SameSite=Strict cookie; SHA-256 hash stored in SQLite; 12h default, optional 7-day "remember me".
- CSRF double-submit token for all mutations; origin check.
- Login rate limiting and lockout, stored server-side.
- CSP, HSTS (when HTTPS), frame denial, no-sniff, referrer policy.
- API listens on 8080; no CORS by default (same origin).
- Internal ban endpoint bound to loopback and authenticated with `/data/runtime/internal-token`.
- MCP endpoint (`/mcp`, `/api/mcp`) authenticated with `/data/runtime/mcp-token`; loopback requests are allowed without a token, remote requests require `Authorization: Bearer <token>`. Tokens are generated on first boot (overridable via `PBX_MCP_TOKEN`? no; `BuildAppOptions.mcpToken` / file).
- Password reset CLI for recovery.

### 3.6 Frontend

- Forced setup wizard: setup code + admin account, region, network, security. Admin password is the only required non-default field.
- App shell: dashboard, Extensions, Trunks, Outbound Routes, Inbound Routes, Ring Groups, IVRs, Voicemail, Security, Snapshots, Logs, Settings.
- Shared Zod schemas drive inline form validation; no free-form Asterisk config.
- Destination picker reused by inbound routes, IVRs, ring groups.
- Snapshot timeline with commit detail, unified diff, rollback confirmation, and "Undo last change".
- Security page: fail2ban settings, live bans, unban, whitelist/blacklist CRUD, audit status.
- Responsive, keyboard accessible, light/dark, empty states, toasts, unsaved-change guard.

## 4. Repository Layout

```
/
├── PROJECT.md
├── PLAN.md
├── README.md
├── Dockerfile
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── apps/
│   ├── api/                  Fastify server, auth, routes, git, CLI wrappers
│   └── web/                  React SPA
├── packages/
│   ├── shared/               Zod schemas, types, API contracts
│   ├── config-engine/        model defaults, validation, renderers, policy
│   └── test-fixtures/        golden model + expected config trees
├── docker/
│   ├── asterisk/             menuselect.makeopts, build scripts
│   ├── s6/                   service definitions, init scripts
│   └── fail2ban/             filter/jail/action templates
├── scripts/                  smoke tests, sipp scenarios, backup/restore
└── docs/                     deployment, security, upgrade, ADRs
```

## 5. Step-by-Step Implementation

Mutable task state lives in `docs/progress/`. This section is the stable map of phases and outcomes; the canonical checklists, exit criteria, verification commands, owners, claims, and handoffs are in the linked phase files. Do not put task checkboxes in this document.

| Phase | Outcome | Depends on | Canonical file |
| --- | --- | --- | --- |
| 0 | Repository scaffold, tooling, CI, architecture ADR | — | [`00-scaffold.md`](docs/progress/phases/00-scaffold.md) |
| 1 | Asterisk 22 image boots under s6 with `/data`, fail2ban, health API | 0 | [`01-runtime.md`](docs/progress/phases/01-runtime.md) |
| 2 | Typed model, security policy, deterministic renderers, golden fixtures | 1 | [`02-config-engine.md`](docs/progress/phases/02-config-engine.md) |
| 3 | Secure API, apply pipeline, Git snapshots and rollback | 2 | [`03-api-core.md`](docs/progress/phases/03-api-core.md) |
| 4 | Frontend shell, forced setup wizard, login, app primitives | 3 | [`04-frontend-shell.md`](docs/progress/phases/04-frontend-shell.md) |
| 5 | Extensions, trunks, and outbound routing CRUD | 2, 3, 4 | [`05-core-crud.md`](docs/progress/phases/05-core-crud.md) |
| 6 | Inbound routing, ring groups, IVRs, prompts, voicemail | 2, 5 | [`06-telephony.md`](docs/progress/phases/06-telephony.md) |
| 7 | fail2ban operations, bans, PJSIP ACL, whitelist/blacklist, audit | 3, 5 | [`07-security.md`](docs/progress/phases/07-security.md) |
| 8 | Snapshot UI, CDR and status, log viewer, backup/restore | 5, 6, 7 | [`08-observability.md`](docs/progress/phases/08-observability.md) |
| 9 | Hardening, full Docker/SIP E2E, docs, release evidence | 0–8 | [`09-release.md`](docs/progress/phases/09-release.md) |
| 10 | Web UI coverage of all core features, full configuration forms, Unifi-inspired dark console | 4, 5, 6, 7, 8 | [`10-web-ui.md`](docs/progress/phases/10-web-ui.md) |
| 11 | Live SIP tracing and log streaming in the Web UI for registration/call debugging | 8, 10 | [`11-live-sip-tracing.md`](docs/progress/phases/11-live-sip-tracing.md) |

### Phase gates

Each phase ends with a working checkpoint, automated checks, and a commit. The verification commands for a phase are listed in its phase file and must pass before it is marked done (see `AGENTS.md` for the definition of done). Phases 1, 7, and 9 additionally require container/SIP or security smoke tests.

### Working agreement

- The lead agent may add tasks to a phase file with the next free ID; agents may not delete or renumber tasks.
- One task, one claim, one writer per file. See `docs/progress/README.md`.
- If a decision changes, update this plan and add an ADR under `docs/adr/`; do not leave it only in chat.
- Security invariants are never traded away to make a gate pass.

## 6. Test Strategy

- **Unit** — Zod validation, defaults, dialplan patterns, security policy, ACL ordering, renderers (golden snapshots), Git wrapper, ban expiry.
- **Integration** — Fastify routes against a temp `/data`: setup gate, auth, CSRF, CRUD, snapshot/rollback, ban API, reload classification. Fake Asterisk/fail2ban via injected command runners.
- **Config validation** — Every golden fixture is loaded by a throwaway Asterisk instance on alternate ports; fail on any error-level log line or missing endpoint/dialplan entry.
- **E2E** — Playwright against the real container: setup, CRUD, wizard defaults, snapshot rollback, security flows.
- **Telephony** — sipp scenario: REGISTER extension, INVITE to feature code/voicemail, assert 200/401/404 and audio path; optional trunk simulation with a second sipp instance.
- **Container** — build, run on `/tmp` data with host network, health check, restart persistence, setup token, fail2ban process, log inspection.
- **Security regression** — assert no unauthenticated endpoint, no anonymous identifier, no catch-all route, fail2ban always enabled, secrets never returned after creation, CSP present.

## 7. Non-Goals for v1

- Fax, conference bridges, call recording management, call-center queues beyond ring groups.
- WebRTC softphone, phone auto-provisioning, SMS, CRM integrations.
- Voicemail-to-email (roadmap; model leaves room for it).
- Multi-tenant, HA/clustering, LDAP/SSO, billing, STIR/SHAKEN.
- Raw Asterisk config editing (read-only viewer only).
- Restoring voicemail/CDR data on config rollback (config only).

## 8. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Asterisk source build is slow/fragile | Multi-stage, pinned version/checksum, apt cache, curated module list, early Docker smoke test; fall back to Debian package only if unavoidable and document. |
| PJSIP ACL changes do not apply on reload | Verify in Phase 7; fallback to `core restart` when idle or optional nftables ban. Add a regression test. |
| fail2ban inside a container without systemd/iptables | File-based polling, custom API action, no `NET_ADMIN` required; synthetic-log integration test. |
| Invalid config reaches Asterisk | Renderer-only output, security policy, golden tests, throwaway Asterisk validation, reload error detection, automatic rollback. |
| Setup page exposed before admin exists | One-time setup code in logs, rate limiting, invalidation after setup. |
| SIP/NAT interoperability | Conservative NAT defaults, transport/TLS/SRTP toggles, documented ports, sipp smoke test. |
| Scope creep | Phased plan; explicit non-goals; MVP vertical slice first. |
| Secret exposure | `/data` permissions, masked API responses, no secrets in logs, documented Git snapshot implications, password-reset CLI. |
| Reload/restart drops calls | Classify changes; restart only when idle; pending-apply state; warn in UI. |

## 9. Unattended Execution Protocol

When implementation starts:

1. Execute phases in order. Do not ask for confirmation on decisions already made here.
2. At each phase boundary run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; for Docker phases also run the container smoke test.
3. Commit each phase with a descriptive message; update `docs/progress/` through `scripts/progress.mjs` (claim, done, render) instead of editing checkboxes in this document.
4. Never weaken a security invariant to make a test pass. If a requirement conflicts, stop and record it in `IMPLEMENTATION.md`.
5. Use `/tmp/opencode` or `/tmp/pbx-*` for throwaway data; never delete a user's real `/data`.
6. If Docker/Asterisk is unavailable, implement against injected fakes, leave the exact verification command, and mark the phase `implemented, needs environment verification`.
7. Record deviations and known limitations as they happen.
8. Final deliverable: working image, green tests, docs, and `IMPLEMENTATION.md`.

## 10. Immediate Next Step

Start Phase 0 and Phase 1: scaffold the monorepo and prove the Asterisk 22 container boots with s6, safe bootstrap config, fail2ban, and a health endpoint. That is the highest-risk integration and the foundation for everything else.
