# BetterPBX Progress

> Generated from `docs/progress/phases/*.md`, `claims/*.md`, and `WORKLOG.md`.
> Do not edit by hand. Run `node scripts/progress.mjs render`.

**Overall:** 4/10 phases done · 30/72 tasks done
**Last phase update:** 2026-11-07T00:57:14Z

## Current focus

- No phase is currently in progress.

## Phases

| Phase | Status | Owner | Tasks | Depends on | Updated |
| --- | --- | --- | --- | --- | --- |
| [Phase 0](phases/00-scaffold.md) — Repository scaffold and decisions | ✔ done | opencode | 5/5 | — | 2026-11-06T00:11:17Z |
| [Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot | ✔ done | opencode | 8/8 | 0 | 2026-11-06T00:58:39Z |
| [Phase 2](phases/02-config-engine.md) — Configuration model and renderer | ✔ done | opencode | 8/8 | 1 | 2026-11-07T00:43:50Z |
| [Phase 3](phases/03-api-core.md) — API core, apply pipeline, and snapshots | ✔ done | opencode | 9/9 | 2 | 2026-11-07T00:57:14Z |
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

- 2026-11-07T00:57:14Z — P3-02 — opencode — Add SQLite migrations for users, sessions, audit log, CDR index, and meta; add a migration command. — commit: ac3537f — implemented in ac3537f
- 2026-11-07T00:57:14Z — P3-03 — opencode — Implement setup status/completion with the one-time setup code, admin creation, session login/logout, CSRF, login rate limiting, and the setup gate middleware. — commit: ac3537f — implemented in ac3537f
- 2026-11-07T00:57:14Z — P3-04 — opencode — Implement the Git manager: init, commit, list, show, diff, restore, clean status, session author, safe argument handling. — commit: ac3537f — implemented in ac3537f
- 2026-11-07T00:57:14Z — P3-05 — opencode — Implement the apply pipeline: model lock, staging render, policy checks, atomic writes, reload classification, failure rollback, audit, and commit. — commit: ac3537f — implemented in ac3537f
- 2026-11-07T00:57:14Z — P3-06 — opencode — Implement Asterisk and fail2ban CLI wrappers with timeouts, parsed output, and injectable runners for tests. — commit: ac3537f — implemented in ac3537f
- 2026-11-07T00:57:14Z — P3-07 — opencode — Implement the internal ban endpoint, ban store with expiry, and sweeper. — commit: ac3537f — implemented in ac3537f
- 2026-11-07T00:57:14Z — P3-08 — opencode — Implement the audit log for every mutation and rollback. — commit: ac3537f — implemented in ac3537f
- 2026-11-07T00:57:14Z — P3-09 — opencode — Add integration tests using a temp `/data` and fake command runners: setup gate, auth, CRUD, commit, diff, rollback, CSRF, stale-write handling. — commit: ac3537f — implemented in ac3537f
