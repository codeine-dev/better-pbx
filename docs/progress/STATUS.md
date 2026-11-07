# BetterPBX Progress

> Generated from `docs/progress/phases/*.md`, `claims/*.md`, and `WORKLOG.md`.
> Do not edit by hand. Run `node scripts/progress.mjs render`.

**Overall:** 11/11 phases done · 86/86 tasks done
**Last phase update:** 2026-11-07T11:21:01Z

## Current focus

- No phase is currently in progress.

## Phases

| Phase | Status | Owner | Tasks | Depends on | Updated |
| --- | --- | --- | --- | --- | --- |
| [Phase 0](phases/00-scaffold.md) — Repository scaffold and decisions | ✔ done | opencode | 5/5 | — | 2026-11-06T00:11:17Z |
| [Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot | ✔ done | opencode | 8/8 | 0 | 2026-11-06T00:58:39Z |
| [Phase 2](phases/02-config-engine.md) — Configuration model and renderer | ✔ done | opencode | 8/8 | 1 | 2026-11-07T00:43:50Z |
| [Phase 3](phases/03-api-core.md) — API core, apply pipeline, and snapshots | ✔ done | opencode | 9/9 | 2 | 2026-11-07T00:57:14Z |
| [Phase 4](phases/04-frontend-shell.md) — Frontend shell and setup wizard | ✔ done | opencode | 6/6 | 3 | 2026-11-07T00:58:58Z |
| [Phase 5](phases/05-core-crud.md) — Extensions, trunks, and outbound routing | ✔ done | opencode | 6/6 | 2, 3, 4 | 2026-11-07T01:02:54Z |
| [Phase 6](phases/06-telephony.md) — Inbound routing, ring groups, IVRs, and voicemail | ✔ done | opencode | 7/7 | 2, 5 | 2026-11-07T01:05:58Z |
| [Phase 7](phases/07-security.md) — Security operations (fail2ban, bans, audit) | ✔ done | opencode | 8/8 | 3, 5 | 2026-11-07T01:08:33Z |
| [Phase 8](phases/08-observability.md) — Snapshots UI, observability, and operations | ✔ done | opencode | 7/7 | 5, 6, 7 | 2026-11-07T01:07:37Z |
| [Phase 9](phases/09-release.md) — Hardening, end-to-end verification, and release | ✔ done | opencode | 8/8 | 0, 1, 2, 3, 4, 5, 6, 7, 8 | 2026-11-07T01:08:27Z |
| [Phase 10](phases/10-web-ui.md) — Web UI coverage, configuration depth, and console polish | ✔ done | opencode | 14/14 | 4, 5, 6, 7, 8 | 2026-11-07T11:21:01Z |

## Active claims

_None._

## Blocked

_None._

## Ready to claim

_None._

## Recent worklog

- 2026-11-07T11:21:01Z — P10-07 — opencode — Inbound routes UI with DID, trunk filter, caller-ID filter, and a shared destination picker. — commit: 36719ad — implemented
- 2026-11-07T11:21:01Z — P10-08 — opencode — Ring groups UI: number, strategy, members, ring time, no-answer destination. — commit: 36719ad — implemented
- 2026-11-07T11:21:01Z — P10-09 — opencode — IVR UI: greeting prompt, timeout, retries, digit options, timeout/invalid destinations, direct dial, cycle validation. — commit: 36719ad — implemented
- 2026-11-07T11:21:01Z — P10-10 — opencode — Prompt management UI: browser, preview, upload with conversion status, delete. — commit: 36719ad — implemented
- 2026-11-07T11:21:01Z — P10-11 — opencode — Voicemail UI: per-extension PIN/email, message counts, MWI status. — commit: 36719ad — implemented
- 2026-11-07T11:21:01Z — P10-12 — opencode — Settings UI: region, network, security thresholds, whitelist/blacklist, voicemail limits. — commit: 36719ad — implemented
- 2026-11-07T11:21:01Z — P10-13 — opencode — Dashboard overview with resource counts, registration/health summaries, and quick actions. — commit: 36719ad — implemented
- 2026-11-07T11:21:01Z — P10-14 — opencode — Add Playwright coverage for the new configuration flows and the dark console shell. — commit: 36719ad — implemented
