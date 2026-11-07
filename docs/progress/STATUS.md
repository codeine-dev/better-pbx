# BetterPBX Progress

> Generated from `docs/progress/phases/*.md`, `claims/*.md`, and `WORKLOG.md`.
> Do not edit by hand. Run `node scripts/progress.mjs render`.

**Overall:** 5/10 phases done · 41/72 tasks done
**Last phase update:** 2026-11-07T01:00:40Z

## Current focus

- Next ready phase: [Phase 5](phases/05-core-crud.md) — Extensions, trunks, and outbound routing

## Phases

| Phase | Status | Owner | Tasks | Depends on | Updated |
| --- | --- | --- | --- | --- | --- |
| [Phase 0](phases/00-scaffold.md) — Repository scaffold and decisions | ✔ done | opencode | 5/5 | — | 2026-11-06T00:11:17Z |
| [Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot | ✔ done | opencode | 8/8 | 0 | 2026-11-06T00:58:39Z |
| [Phase 2](phases/02-config-engine.md) — Configuration model and renderer | ✔ done | opencode | 8/8 | 1 | 2026-11-07T00:43:50Z |
| [Phase 3](phases/03-api-core.md) — API core, apply pipeline, and snapshots | ✔ done | opencode | 9/9 | 2 | 2026-11-07T00:57:14Z |
| [Phase 4](phases/04-frontend-shell.md) — Frontend shell and setup wizard | ✔ done | opencode | 6/6 | 3 | 2026-11-07T00:58:58Z |
| [Phase 5](phases/05-core-crud.md) — Extensions, trunks, and outbound routing | ○ ready | — | 5/6 | 2, 3, 4 | 2026-11-07T01:00:40Z |
| [Phase 6](phases/06-telephony.md) — Inbound routing, ring groups, IVRs, and voicemail | · not_started | — | 0/7 | 2, 5 | 2026-11-05T00:00:00Z |
| [Phase 7](phases/07-security.md) — Security operations (fail2ban, bans, audit) | · not_started | — | 0/8 | 3, 5 | 2026-11-05T00:00:00Z |
| [Phase 8](phases/08-observability.md) — Snapshots UI, observability, and operations | · not_started | — | 0/7 | 5, 6, 7 | 2026-11-05T00:00:00Z |
| [Phase 9](phases/09-release.md) — Hardening, end-to-end verification, and release | · not_started | — | 0/8 | 0, 1, 2, 3, 4, 5, 6, 7, 8 | 2026-11-05T00:00:00Z |

## Active claims

_None._

## Blocked

_None._

## Ready to claim

- **P5-06** — Add golden and API integration tests for create/edit/delete and the resulting rendered `pjsip.conf`/`extensions.conf`. _([Phase 5](phases/05-core-crud.md) — Extensions, trunks, and outbound routing)_

## Recent worklog

- 2026-11-07T00:58:28Z — P4-04 — opencode — Build the app shell: sidebar, header, responsive navigation, light/dark theme, and a dashboard skeleton with service status cards and a setup checklist. — commit: 2905133 — frontend base implemented
- 2026-11-07T00:58:28Z — P4-05 — opencode — Add the shared UI primitives: error/toast/dialog/table/form components, loading skeletons, empty states, unsaved-change guard, and accessible focus handling. — commit: 2905133 — frontend base implemented
- 2026-11-07T00:58:58Z — P4-06 — opencode — Add Playwright coverage for first-run setup (happy path and validation errors), login, logout, and the forced-setup guard. — commit: b445a1b — playwright tests added; needs browser/env verification
- 2026-11-07T01:00:40Z — P5-01 — opencode — Extensions API/UI: number, display name, codecs, secret generate/reveal-once/reset, transport, NAT settings, max contacts, voicemail fields, enable/disable; enforce unique numbers. — commit: 6e1700e — implemented (basic)
- 2026-11-07T01:00:40Z — P5-02 — opencode — Trunks API/UI: registration vs IP authentication, provider CIDRs, transport, TLS/SRTP, codecs, caller ID, from user/domain, outbound proxy; reject unauthenticated or `0.0.0.0/0` trust. — commit: 6e1700e — implemented (basic)
- 2026-11-07T01:00:40Z — P5-03 — opencode — Outbound routes API/UI: dialplan patterns, strip/prepend, caller ID override, trunk selection, emergency route setting, premium/unsafe confirmation; reject catch-all patterns by default. — commit: 6e1700e — implemented (basic)
- 2026-11-07T01:00:40Z — P5-04 — opencode — Add apply/reload feedback, dialplan overlap and conflict warnings, and delete guards for resources still referenced by routes. — commit: 6e1700e — implemented (basic)
- 2026-11-07T01:00:40Z — P5-05 — opencode — Update the dashboard checklist as extensions, trunks, and routes are added. — commit: 6e1700e — implemented (basic)
