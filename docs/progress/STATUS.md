# BetterPBX Progress

> Generated from `docs/progress/phases/*.md`, `claims/*.md`, and `WORKLOG.md`.
> Do not edit by hand. Run `node scripts/progress.mjs render`.

**Overall:** 1/10 phases done · 5/72 tasks done
**Last phase update:** 2026-11-06T00:16:23Z

## Current focus

- [Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot — owner: `opencode`

## Phases

| Phase | Status | Owner | Tasks | Depends on | Updated |
| --- | --- | --- | --- | --- | --- |
| [Phase 0](phases/00-scaffold.md) — Repository scaffold and decisions | ✔ done | opencode | 5/5 | — | 2026-11-06T00:11:17Z |
| [Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot | ◐ in_progress | opencode | 0/8 | 0 | 2026-11-06T00:16:23Z |
| [Phase 2](phases/02-config-engine.md) — Configuration model and renderer | · not_started | — | 0/8 | 1 | 2026-11-05T00:00:00Z |
| [Phase 3](phases/03-api-core.md) — API core, apply pipeline, and snapshots | · not_started | — | 0/9 | 2 | 2026-11-05T00:00:00Z |
| [Phase 4](phases/04-frontend-shell.md) — Frontend shell and setup wizard | · not_started | — | 0/6 | 3 | 2026-11-05T00:00:00Z |
| [Phase 5](phases/05-core-crud.md) — Extensions, trunks, and outbound routing | · not_started | — | 0/6 | 2, 3, 4 | 2026-11-05T00:00:00Z |
| [Phase 6](phases/06-telephony.md) — Inbound routing, ring groups, IVRs, and voicemail | · not_started | — | 0/7 | 2, 5 | 2026-11-05T00:00:00Z |
| [Phase 7](phases/07-security.md) — Security operations (fail2ban, bans, audit) | · not_started | — | 0/8 | 3, 5 | 2026-11-05T00:00:00Z |
| [Phase 8](phases/08-observability.md) — Snapshots UI, observability, and operations | · not_started | — | 0/7 | 5, 6, 7 | 2026-11-05T00:00:00Z |
| [Phase 9](phases/09-release.md) — Hardening, end-to-end verification, and release | · not_started | — | 0/8 | 0, 1, 2, 3, 4, 5, 6, 7, 8 | 2026-11-05T00:00:00Z |

## Active claims

| Task | Phase | Agent | Started | Lease until | Note |
| --- | --- | --- | --- | --- | --- |
| P1-01 | 1 | opencode | 2026-11-06T00:16:23Z | 2026-11-06T08:16:23Z | Phase 1: build pinned Asterisk 22.12.0 runtime image, s6 services, bootstrap config, and smoke test |

## Blocked

_None._

## Ready to claim

- **P1-02** — Install core/extra sound packs (English by default; add other languages where packages exist), MOH, and verify paths. _([Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot)_
- **P1-03** — Implement the s6 one-shot init: `/data` layout, `pbx`/`asterisk` users and groups, permissions, timezone, self-signed SIP TLS material, bootstrap model, Git init. _([Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot)_
- **P1-04** — Write the static bootstrap Asterisk config: UDP/TLS transports, no endpoints, safe modules, disabled AMI/ARI/HTTP, security log, fail2ban baseline. _([Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot)_
- **P1-05** — Add s6 services for Asterisk, fail2ban, and the placeholder API; define dependencies and restart behavior. _([Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot)_
- **P1-06** — Add container healthcheck, stdout logging, graceful shutdown, and a clear first-boot setup-code message. _([Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot)_
- **P1-07** — Write `scripts/smoke-container.sh` to build, run with a temporary `/data`, wait for health, and assert Asterisk/fail2ban/API. _([Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot)_
- **P1-08** — Run the container smoke test, including a restart against the same `/data`, and record the result in the worklog/handoff. _([Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot)_

## Recent worklog

- 2026-11-06T00:08:04Z — P0-01 — opencode — Write `README.md` skeleton and `docs/adr/0001-architecture.md` (condensed from `PLAN.md`). — commit: n/a — README skeleton and architecture ADR
- 2026-11-06T00:09:41Z — P0-02 — opencode — Create the pnpm workspace, strict TypeScript config, package layout (`apps/api`, `apps/web`, `packages/shared`, `packages/config-engine`, `packages/test-fixtures`), ESLint 9, Prettier, Vitest. — commit: n/a — pnpm workspace, strict TS, package layout, ESLint 9, Prettier, Vitest
- 2026-11-06T00:10:17Z — P0-03 — opencode — Add root scripts: `lint`, `typecheck`, `test`, `test:e2e`, `build`, `dev`, `docker:build`; keep the progress scripts. — commit: n/a — root scripts verified: lint, typecheck, test, build, test:e2e
- 2026-11-06T00:10:27Z — P0-04 — opencode — Add CI workflow for install, lint, typecheck, unit tests, and build; keep the progress workflow. — commit: n/a — CI runs install, lint, typecheck, test, build; progress workflow unchanged
- 2026-11-06T00:11:04Z — P0-05 — opencode — Add `.gitignore`, `.editorconfig`, and `.dockerignore`; ensure generated artifacts, local data, and secrets are ignored. — commit: 8f2e41c — gitignore, editorconfig, dockerignore; removed tracked node_modules/dist
- 2026-11-06T00:11:17Z — P0-03 — opencode — Add root scripts: `lint`, `typecheck`, `test`, `test:e2e`, `build`, `dev`, `docker:build`; keep the progress scripts. — commit: b0a5c97 — scripts implemented and verified; tracker checkbox restored after a concurrent-write race
