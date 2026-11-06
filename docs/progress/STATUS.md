# BetterPBX Progress

> Generated from `docs/progress/phases/*.md`, `claims/*.md`, and `WORKLOG.md`.
> Do not edit by hand. Run `node scripts/progress.mjs render`.

**Overall:** 2/10 phases done · 13/72 tasks done
**Last phase update:** 2026-11-06T00:58:39Z

## Current focus

- No phase is currently in progress.

## Phases

| Phase | Status | Owner | Tasks | Depends on | Updated |
| --- | --- | --- | --- | --- | --- |
| [Phase 0](phases/00-scaffold.md) — Repository scaffold and decisions | ✔ done | opencode | 5/5 | — | 2026-11-06T00:11:17Z |
| [Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot | ✔ done | opencode | 8/8 | 0 | 2026-11-06T00:58:39Z |
| [Phase 2](phases/02-config-engine.md) — Configuration model and renderer | · not_started | — | 0/8 | 1 | 2026-11-05T00:00:00Z |
| [Phase 3](phases/03-api-core.md) — API core, apply pipeline, and snapshots | · not_started | — | 0/9 | 2 | 2026-11-05T00:00:00Z |
| [Phase 4](phases/04-frontend-shell.md) — Frontend shell and setup wizard | · not_started | — | 0/6 | 3 | 2026-11-05T00:00:00Z |
| [Phase 5](phases/05-core-crud.md) — Extensions, trunks, and outbound routing | · not_started | — | 0/6 | 2, 3, 4 | 2026-11-05T00:00:00Z |
| [Phase 6](phases/06-telephony.md) — Inbound routing, ring groups, IVRs, and voicemail | · not_started | — | 0/7 | 2, 5 | 2026-11-05T00:00:00Z |
| [Phase 7](phases/07-security.md) — Security operations (fail2ban, bans, audit) | · not_started | — | 0/8 | 3, 5 | 2026-11-05T00:00:00Z |
| [Phase 8](phases/08-observability.md) — Snapshots UI, observability, and operations | · not_started | — | 0/7 | 5, 6, 7 | 2026-11-05T00:00:00Z |
| [Phase 9](phases/09-release.md) — Hardening, end-to-end verification, and release | · not_started | — | 0/8 | 0, 1, 2, 3, 4, 5, 6, 7, 8 | 2026-11-05T00:00:00Z |

## Active claims

_None._

## Blocked

_None._

## Ready to claim

_None._

## Recent worklog

- 2026-11-06T00:58:38Z — P1-01 — opencode — Build the multi-stage Dockerfile: Debian 13 builder, pinned Asterisk 22.x with SHA-256, bundled pjproject/jansson, curated `menuselect.makeopts`; runtime with Node 24, s6-overlay 3, fail2ban, git, sox, openssl, tzdata, SQLite. — commit: 03e774b — docker build better-pbx:dev; pinned Asterisk 22.12.0 SHA-256, bundled pjproject/jansson, Node 24, s6-overlay 3.2.3.2, fail2ban, git, sox, openssl, tzdata, SQLite
- 2026-11-06T00:58:38Z — P1-02 — opencode — Install core/extra sound packs (English by default; add other languages where packages exist), MOH, and verify paths. — commit: 03e774b — English core 1.6.1 and extra 1.5.2 (ulaw/gsm/g722) plus MOH 2.03 installed with pinned checksums; paths verified in image
- 2026-11-06T00:58:38Z — P1-03 — opencode — Implement the s6 one-shot init: `/data` layout, `pbx`/`asterisk` users and groups, permissions, timezone, self-signed SIP TLS material, bootstrap model, Git init. — commit: 03e774b — init-pbx creates /data layout, pbx/asterisk identities, permissions, timezone, self-signed SIP TLS, bootstrap model, Git repo; idempotent across restart
- 2026-11-06T00:58:39Z — P1-04 — opencode — Write the static bootstrap Asterisk config: UDP/TLS transports, no endpoints, safe modules, disabled AMI/ARI/HTTP, security log, fail2ban baseline. — commit: 03e774b — bootstrap Asterisk config: UDP/TLS transports, no endpoints, explicit safe modules, AMI/ARI/HTTP disabled, security log, fail2ban baseline
- 2026-11-06T00:58:39Z — P1-05 — opencode — Add s6 services for Asterisk, fail2ban, and the placeholder API; define dependencies and restart behavior. — commit: 03e774b — s6 longrun services for asterisk, fail2ban and placeholder API with init-pbx dependency, restart behavior, and shutdown timeouts
- 2026-11-06T00:58:39Z — P1-06 — opencode — Add container healthcheck, stdout logging, graceful shutdown, and a clear first-boot setup-code message. — commit: 03e774b — container healthcheck covers API/Asterisk/fail2ban; stdout logging, graceful SIGTERM shutdown, first-boot setup code in logs
- 2026-11-06T00:58:39Z — P1-07 — opencode — Write `scripts/smoke-container.sh` to build, run with a temporary `/data`, wait for health, and assert Asterisk/fail2ban/API. — commit: 03e774b — scripts/smoke-container.sh builds and runs with temporary /data, waits for health, asserts services/config/ports, restarts, and checks graceful stop
- 2026-11-06T00:58:39Z — P1-08 — opencode — Run the container smoke test, including a restart against the same `/data`, and record the result in the worklog/handoff. — commit: 03e774b — smoke test passed including restart persistence, setup gate, no AMI/ARI/HTTP listeners, and graceful shutdown exit 0; phase verification command passed
