# BetterPBX Progress

> Generated from `docs/progress/phases/*.md`, `claims/*.md`, and `WORKLOG.md`.
> Do not edit by hand. Run `node scripts/progress.mjs render`.

**Overall:** 4/10 phases done · 35/72 tasks done
**Last phase update:** 2026-11-07T00:58:28Z

## Current focus

- Next ready phase: [Phase 4](phases/04-frontend-shell.md) — Frontend shell and setup wizard

## Phases

| Phase | Status | Owner | Tasks | Depends on | Updated |
| --- | --- | --- | --- | --- | --- |
| [Phase 0](phases/00-scaffold.md) — Repository scaffold and decisions | ✔ done | opencode | 5/5 | — | 2026-11-06T00:11:17Z |
| [Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot | ✔ done | opencode | 8/8 | 0 | 2026-11-06T00:58:39Z |
| [Phase 2](phases/02-config-engine.md) — Configuration model and renderer | ✔ done | opencode | 8/8 | 1 | 2026-11-07T00:43:50Z |
| [Phase 3](phases/03-api-core.md) — API core, apply pipeline, and snapshots | ✔ done | opencode | 9/9 | 2 | 2026-11-07T00:57:14Z |
| [Phase 4](phases/04-frontend-shell.md) — Frontend shell and setup wizard | ○ ready | — | 5/6 | 3 | 2026-11-07T00:58:28Z |
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

- **P4-06** — Add Playwright coverage for first-run setup (happy path and validation errors), login, logout, and the forced-setup guard. _([Phase 4](phases/04-frontend-shell.md) — Frontend shell and setup wizard)_

## Recent worklog

- 2026-11-07T00:57:14Z — P3-07 — opencode — Implement the internal ban endpoint, ban store with expiry, and sweeper. — commit: ac3537f — implemented in ac3537f
- 2026-11-07T00:57:14Z — P3-08 — opencode — Implement the audit log for every mutation and rollback. — commit: ac3537f — implemented in ac3537f
- 2026-11-07T00:57:14Z — P3-09 — opencode — Add integration tests using a temp `/data` and fake command runners: setup gate, auth, CRUD, commit, diff, rollback, CSRF, stale-write handling. — commit: ac3537f — implemented in ac3537f
- 2026-11-07T00:58:28Z — P4-01 — opencode — Build the Vite/React/Tailwind/shadcn base: router, query client, typed API client with CSRF and ETag/`If-Match` handling, shared Zod schemas from `packages/shared`. — commit: 2905133 — frontend base implemented
- 2026-11-07T00:58:28Z — P4-02 — opencode — Implement the login page, auth guard, forced `/setup` redirect, and the setup-code step; no other route is usable before setup completes. — commit: 2905133 — frontend base implemented
- 2026-11-07T00:58:28Z — P4-03 — opencode — Implement the multi-step setup wizard with detected defaults (timezone, locale, network interfaces, emergency numbers, language) and an "accept defaults" path; only the admin password is mandatory. — commit: 2905133 — frontend base implemented
- 2026-11-07T00:58:28Z — P4-04 — opencode — Build the app shell: sidebar, header, responsive navigation, light/dark theme, and a dashboard skeleton with service status cards and a setup checklist. — commit: 2905133 — frontend base implemented
- 2026-11-07T00:58:28Z — P4-05 — opencode — Add the shared UI primitives: error/toast/dialog/table/form components, loading skeletons, empty states, unsaved-change guard, and accessible focus handling. — commit: 2905133 — frontend base implemented
