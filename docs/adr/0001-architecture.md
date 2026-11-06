# ADR 0001 — BetterPBX architecture

- **Status:** Accepted
- **Date:** 2026-11-06
- **Source:** Condensed from [`PLAN.md`](../../PLAN.md)

## Context

BetterPBX must ship as one Docker image that a small operator can run with a single command. The
image needs a production-grade SIP engine, a configuration surface that cannot produce unsafe
Asterisk config, auditable change history with rollback, and a modern admin UI. It also needs to be
buildable and testable by multiple agents working unattended.

The main forces are:

- Correctness and safety of generated telephony config.
- Deterministic, reviewable change history.
- Simple deployment and persistence (one volume, `/data`).
- Testability without a live phone network.
- A single language and validation layer across API and UI.

## Decisions

### 1. Asterisk 22 LTS, built from source

Asterisk 22 is the current LTS. The image builds a pinned release from source on Debian 13
(trixie) with bundled pjproject and jansson, verifies the release checksum, and compiles only the
modules that are needed. This avoids distro packaging drift and lets us pin and audit the exact
telephony engine.

Legacy `chan_sip` is not built or configured. PJSIP is the only SIP channel driver.

### 2. A typed model plus a deterministic renderer, never raw config editing

The source of truth is a versioned YAML document at `/data/config/pbx.yaml`. The API validates it
with Zod, resolves cross-resource references, runs a security policy, and renders the complete
`/data/config/asterisk/*` tree. `/etc/asterisk` points at that tree.

Why:

- The UI and API can only produce valid, hardened configuration.
- Rendering is deterministic, so Git diffs and snapshots are meaningful.
- No lossy parsing or serialising of Asterisk `.conf` files.
- Rollback restores the model and re-renders it instead of restoring stale text.

A read-only raw config viewer is allowed for transparency. An editable raw config surface is not.

### 3. Git snapshots of the model and rendered output

`/data/config` is a Git repository. Every successful mutation:

1. Validates the proposed model.
2. Renders a staging tree.
3. Runs security checks and, for structural changes, a throwaway Asterisk config check.
4. Writes the files atomically.
5. Reloads the affected Asterisk modules.
6. Commits the model and rendered files with the admin identity and change description.

Rollback checks out the chosen model, re-renders, reloads, and creates a new commit. History is
never rewritten. Secrets necessarily appear in the model and rendered output; `/data` is
root/admin-only and this is documented. API responses mask secrets after creation.

### 4. One image with supervised processes under s6-overlay

`s6-overlay` is PID 1 and supervises:

- `asterisk` as `asterisk:pbx`
- `better-pbx-api` as `pbx:pbx`
- `fail2ban` as root, using a local API ban action

A one-shot init service creates `/data`, fixes ownership, generates self-signed SIP TLS material,
initialises Git, and writes the bootstrap model before the long-running services start.

All persistent state lives under `/data`, including voicemail at `/data/voicemail`, sounds, runtime
state, logs, fail2ban state, and the SQLite database.

### 5. Node/TypeScript end to end

- API: Fastify 5, Zod, better-sqlite3.
- UI: React 19, Vite 7, TypeScript, Tailwind 4, shadcn/ui, TanStack Query, React Hook Form.
- Monorepo: pnpm workspaces. Shared Zod schemas and types are consumed by both API and UI.
- Config engine: a pure TypeScript package with no I/O, verified with golden fixtures.

This gives one language, one validation layer, and fast unattended iteration.

### 6. Security is enforced in the model and the renderer

The API and UI reject unsafe choices; the renderer additionally runs a security policy over every
generated tree. In particular:

- Every endpoint authenticates; there is no anonymous endpoint.
- Trunks use registration auth or a specific provider IP/CIDR, never `0.0.0.0/0`.
- Outbound routes cannot be catch-all unless explicitly confirmed, and are rejected by default.
- Premium-rate and high-risk prefixes are blocked by default.
- Codecs are limited to ulaw/alaw/gsm/g722.
- PJSIP excludes `anonymous` identifiers and raises security events for unidentified requests.
- AMI, ARI, and Asterisk's internal HTTP server are disabled.
- Dangerous modules (`app_system`, `app_exec`, `app_disa`, legacy channel drivers) are not loaded.
- Fail2ban cannot be disabled from the UI.
- Whitelist and blacklist entries are CIDR-validated, mutually exclusive, and applied to both
  fail2ban and the PJSIP ACL.

A security invariant is never weakened just to make a test or gate pass.

### 7. fail2ban without extra container capabilities

fail2ban reads Asterisk's structured `security` log. Its ban action calls a local `pbx-ban` helper
that POSTs to the API over loopback with a one-time internal token. The API records the ban,
regenerates the global PJSIP ACL, and reloads PJSIP. This blocks offending addresses at the SIP
layer without `NET_ADMIN`. If the operator grants `NET_ADMIN` and enables firewall bans, the same
action can also add an nftables rule. Automatic bans expire; manual blacklist entries are permanent
ACL denies. The API sweeps expired bans in case an unban callback is missed.

### 8. One-time setup code

On an empty volume the API is reachable before an admin exists. First-run setup therefore requires
a one-time code printed to container logs, stored at `/data/setup-token`, and invalidated after
setup. `PBX_SETUP_TOKEN` can override it for automated provisioning. This is the only mandatory
secret in the wizard; every other field has a safe default.

### 9. Regional defaults

The wizard preselects country, timezone, language, emergency numbers, and dial prefixes from the
browser locale and server timezone. Country selection drives `indications.conf` tones and emergency
number defaults; language selection drives installed sound packs and channel language. The user can
accept all defaults.

## Consequences

- Configuration is safe by construction, at the cost of not supporting arbitrary Asterisk features
  in v1.
- Snapshots are simple and reviewable, but secrets are present in `/data/config` Git history.
- Deployment stays simple (`--network=host`, one volume), while TLS and NAT still need operator
  configuration.
- The config engine has no I/O dependency, so golden-file tests are fast and reliable.
- Runtime-only state (automatic bans, tokens) lives outside the committed tree and is regenerated
  from the model plus the ban store.

## Non-goals for v1

Fax, conference bridges, recording management, call-centre queues beyond ring groups, WebRTC
softphone, phone auto-provisioning, SMS, CRM integrations, voicemail-to-email, multi-tenancy,
HA/clustering, LDAP/SSO, billing, STIR/SHAKEN, raw config editing, and restoring voicemail or CDR
data on rollback.

## Alternatives considered

- **Editing Asterisk `.conf` directly:** unsafe and hard to validate; makes rollback textual and
  lossy.
- **Asterisk realtime via ODBC:** more moving parts and harder to snapshot.
- **`astdb` as source of truth:** not reviewable.
- **Debian's Asterisk package:** less control and known packaging drift.
- **Asterisk 24:** too new for production at the time of writing.
- **FreeSWITCH:** the product requirement is Asterisk.
