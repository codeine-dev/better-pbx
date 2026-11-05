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
```

Conventions: JSON, camelCase, Zod-validated bodies, ETag/`If-Match` on mutations, `409` on stale writes, structured errors, OpenAPI docs at `/api/docs`.

### 3.5 Auth and API hardening

- Single admin role in v1 (schema supports more users later); Argon2id password hashes.
- Opaque session token in an HttpOnly, SameSite=Strict cookie; SHA-256 hash stored in SQLite; 12h default, optional 7-day "remember me".
- CSRF double-submit token for all mutations; origin check.
- Login rate limiting and lockout, stored server-side.
- CSP, HSTS (when HTTPS), frame denial, no-sniff, referrer policy.
- API listens on 8080; no CORS by default (same origin).
- Internal ban endpoint bound to loopback and authenticated with `/data/runtime/internal-token`.
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

Each phase ends with a working checkpoint, automated checks, and a commit. The plan is ordered to derisk Asterisk/Docker first, then build the product around a validated telephony core.

### Phase 0 — Repository scaffold and decisions

- [ ] Write `README.md` skeleton and `docs/adr/0001-architecture.md` (condensed from this plan).
- [ ] pnpm workspace, strict TypeScript, ESLint 9, Prettier, Vitest, Playwright config.
- [ ] Root scripts: `lint`, `typecheck`, `test`, `test:e2e`, `build`, `dev`, `docker:build`.
- [ ] CI workflow running install, lint, typecheck, unit tests, build.
- [ ] `.gitignore`, `.editorconfig`, `.dockerignore`.

Exit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes on an empty workspace; first feature commit is possible.

### Phase 1 — Asterisk runtime image and boot (vertical slice)

- [ ] Multi-stage Dockerfile: Debian 13 builder, pinned Asterisk 22.x, bundled pjproject/jansson, curated `menuselect.makeopts`; runtime with Node 24, s6-overlay 3, fail2ban, git, sox, openssl, tzdata, SQLite.
- [ ] Install Asterisk core/extra sound packs (en by default; add others where packages exist) and MOH.
- [ ] s6 init: create `/data` layout, users/groups, permissions, timezone, self-signed SIP TLS cert, bootstrap model, Git init.
- [ ] Static bootstrap Asterisk config: transports, no endpoints, fail2ban, security logging, safe modules, disabled AMI/ARI/HTTP.
- [ ] s6 services: Asterisk, fail2ban, placeholder API with `/api/health`.
- [ ] Container healthcheck, graceful shutdown, log to stdout.
- [ ] Makefile/script `scripts/smoke-container.sh`.

Exit:

- `docker build -t better-pbx:dev .` succeeds.
- `docker run --network=host -v /tmp/pbx:/data better-pbx:dev` starts; `asterisk -rx "core show version"` works inside; `/api/health` returns OK; fail2ban is running; logs show the setup code.
- Restarting the container reuses `/data` cleanly.

### Phase 2 — Config engine

- [ ] `packages/shared`: full Zod model, destination union, defaults for all resources, schema version/migration hook.
- [ ] `packages/config-engine`: deterministic renderers for every file listed in §3.2.
- [ ] Security policy: endpoint auth, trunk trust, codec allow-list, catch-all route rejection, premium prefix policy, secret strength, CIDR validation, ACL generation.
- [ ] Dialplan pattern parser/validator (`_N`, `_X`, `_Z`, `.`, `!`, ranges, literals), conflict and overlap detection, emergency-route generation.
- [ ] Cross-resource validation: unique numbers/slugs, existing references, IVR/ring-group cycles, prompt existence, inbound destinations.
- [ ] Golden fixture: a complete model covering every feature; snapshot every rendered file.
- [ ] Unit tests for defaults, validation failures, dangerous patterns, ACL ordering, secret generation.
- [ ] Temporary-Asterisk validator helper (alternate ports, temporary directories) used by tests and later by the API.

Exit: all golden files reviewed; `pnpm test` green; a deliberately unsafe model is rejected with actionable errors; the golden config starts in a throwaway Asterisk and reports endpoints/dialplan.

### Phase 3 — API core, apply pipeline, snapshots

- [ ] Fastify app, config, structured logging, error envelope, OpenAPI, static SPA fallback.
- [ ] SQLite migrations for users, sessions, audit log, CDR index, meta.
- [ ] Setup gate middleware, setup status, setup completion with token, admin creation, session login/logout, CSRF, rate limiting.
- [ ] Git manager: init, commit, list, show, diff, restore, clean status; author from session; safe argument handling.
- [ ] Apply pipeline (§3.3) with model lock, staging render, policy checks, atomic writes, reload classification, rollback on failure.
- [ ] Asterisk CLI wrapper (`asterisk -C ... -rx`) and fail2ban wrapper, injectable for tests.
- [ ] Internal ban endpoint and ban store with expiry sweeper.
- [ ] Audit log for every mutation and rollback.
- [ ] Integration tests with a fake Asterisk/fail2ban and a temp `/data`.

Exit: API bootstraps a temp `/data`, completes setup, logs in, CRUDs a model, creates a Git commit, returns diff, rolls back, and enforces setup/auth/CSRF. No real Asterisk required for these tests.

### Phase 4 — Frontend shell and setup wizard

- [ ] Vite/React/Tailwind/shadcn base, router, query client, API client with CSRF/ETag handling.
- [ ] Login page, auth guard, forced `/setup` redirect, setup-code step.
- [ ] Multi-step wizard with detected defaults (timezone, locale, interfaces, emergency numbers, language) and "accept defaults".
- [ ] App shell (sidebar, header, responsive nav, theme), dashboard skeleton with status cards and setup checklist.
- [ ] Error/toast/dialog/table/form primitives; loading and empty states.
- [ ] Playwright: first-run setup, validation errors, login, logout.

Exit: with a real container, a fresh volume can be set up end to end in the browser; no API endpoint other than setup/health is reachable before setup.

### Phase 5 — Extensions, trunks, and outbound routing

- [ ] Extensions UI/API: number, name, codecs, secret generate/reveal-once/reset, transport, NAT, max contacts, voicemail fields, enable/disable.
- [ ] Trunks UI/API: registration vs IP auth, provider CIDRs, transport, TLS/SRTP, codecs, caller ID, from user/domain, outbound proxy.
- [ ] Outbound routes UI/API: patterns, strip/prepend, caller ID, trunk selection, premium/unsafe confirmation, emergency route setting.
- [ ] Apply/reload feedback, conflict warnings, delete guards for referenced resources.
- [ ] Dashboard checklist updates as resources are added.
- [ ] Golden + integration tests for create/edit/delete and rendered output.

Exit: create extension 101, trunk, and a `_9NXXXXXX` route in the UI; rendered `pjsip.conf`/`extensions.conf` load in Asterisk; snapshot created; deleting the trunk is blocked while a route uses it.

### Phase 6 — Inbound routing, ring groups, IVRs, voicemail

- [ ] Inbound routes UI/API with DID/pattern matching, optional trunk filter, destination picker, caller-ID filter.
- [ ] Ring groups: number, strategy, members, ring time, no-answer destination; generate queues.
- [ ] IVRs: greeting, timeout/retries, digit options, invalid/timeout destinations, direct dial; cycle detection.
- [ ] Prompt management: built-in prompt browser/preview, upload, sox conversion to 8 kHz mono WAV, safe paths, duration/size limits.
- [ ] Voicemail: per-extension mailbox/PIN/MWI, `*97`/`*98`, spool at `/data/voicemail`, message counts in UI.
- [ ] Feature codes: voicemail, call pickup; documented and tested.
- [ ] Renderer integration test for a full PBX with all features.

Exit: a complete fixture starts in Asterisk with no config errors; inbound DID reaches extension/ring group/IVR; IVR digit routes; unanswered call reaches voicemail; message appears under `/data/voicemail`; MWI is configured.

### Phase 7 — Security operations (fail2ban, bans, audit)

- [ ] Generate fail2ban jail/filter/action from settings; custom `pbx-ban` action calling the internal API.
- [ ] Runtime PJSIP ACL include: whitelist permits, manual/automatic denies, allow-all fallback; PJSIP reload on change.
- [ ] Bans API/UI: live bans, source, jail, expiry, unban, manual blacklist, whitelist override, fail2ban status.
- [ ] Security page: fail2ban tuning, whitelist/blacklist CRUD with CIDR validation and conflict rejection, login lockout, security audit checks.
- [ ] Expiry sweeper and startup reconciliation with fail2ban state.
- [ ] Optional nftables bans when `NET_ADMIN` is present and enabled.
- [ ] Audit log UI (who changed what, when, snapshot SHA).
- [ ] Tests: synthetic security log lines, regex check, real fail2ban ban/unban, ACL reload, whitelist prevents ban, blacklist forces ban.

Exit: inject failed registrations; fail2ban bans the IP; the IP appears in the UI; the ACL blocks it; unban clears both; whitelisting an IP immediately unbans it and prevents re-ban; blacklisting forces a ban even when fail2ban is idle.

### Phase 8 — Snapshots UI, observability, operations

- [ ] Snapshot timeline, commit detail, unified diff, rollback and undo-last with confirmations; "configuration drift" indicator.
- [ ] CDR ingestion from Asterisk CSV, recent-calls table, call duration/disposition.
- [ ] Registrations, active calls, queue status, voicemail counts, uptime, disk usage, service health.
- [ ] Log viewer for messages/security with filters and bounded tail.
- [ ] Pending-restart banner and "apply when idle".
- [ ] Backup/restore docs and scripts (config Git bundle + voicemail + DB).
- [ ] Playwright snapshot/rollback and security flows.

Exit: make a change, view the diff, roll back, and see Asterisk reload; recent calls and registrations populate; logs are viewable without exposing arbitrary files.

### Phase 9 — Hardening, end-to-end, release

- [ ] CSP and all security headers verified; cookies Secure when TLS terminates; no secrets in API responses/logs.
- [ ] Container hardening: run services as dedicated users, `cap_drop: ALL` by default, read-only root-fs support, tmpfs where needed, no shell endpoints.
- [ ] Full E2E in Docker: clean volume -> setup -> extension/trunk/route -> SIP REGISTER with sipp -> call flow -> voicemail -> snapshot rollback -> fail2ban ban/unban.
- [ ] Optional SIP smoke test script using sipp/pjsua; documented.
- [ ] Image size/build-time check; dependency and container scan.
- [ ] README: quick start, ports, volumes, reverse proxy/TLS, NAT, backup, upgrade, recovery, security model, limitations.
- [ ] Upgrade path: schema migrations, renderer version, image tag strategy.
- [ ] Final `IMPLEMENTATION.md` with verification results and known limitations.

Exit (whole project acceptance):

1. `docker build -t better-pbx .` succeeds and the image runs with the documented one-liner.
2. Fresh volume forces the setup wizard; setup code is required; only the admin password has no default.
3. A softphone can register with the configured codecs; outbound, inbound, IVR, ring group, and voicemail all work.
4. Voicemail is stored under `/data/voicemail` and survives container replacement.
5. Every change produces a snapshot; diff and rollback work.
6. Failed registrations trigger fail2ban and a working SIP-layer ban; whitelist/blacklist work as described.
7. Lint, typecheck, unit, integration, Playwright, Docker smoke, and SIP smoke pass.
8. Docs cover deployment, security, backup, and recovery.

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
3. Commit each phase with a descriptive message; keep `PLAN.md` checkboxes updated.
4. Never weaken a security invariant to make a test pass. If a requirement conflicts, stop and record it in `IMPLEMENTATION.md`.
5. Use `/tmp/opencode` or `/tmp/pbx-*` for throwaway data; never delete a user's real `/data`.
6. If Docker/Asterisk is unavailable, implement against injected fakes, leave the exact verification command, and mark the phase `implemented, needs environment verification`.
7. Record deviations and known limitations as they happen.
8. Final deliverable: working image, green tests, docs, and `IMPLEMENTATION.md`.

## 10. Immediate Next Step

Start Phase 0 and Phase 1: scaffold the monorepo and prove the Asterisk 22 container boots with s6, safe bootstrap config, fail2ban, and a health endpoint. That is the highest-risk integration and the foundation for everything else.
