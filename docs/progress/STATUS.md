# BetterPBX Progress

> Generated from `docs/progress/phases/*.md`, `claims/*.md`, and `WORKLOG.md`.
> Do not edit by hand. Run `node scripts/progress.mjs render`.

**Overall:** 7/10 phases done · 49/72 tasks done
**Last phase update:** 2026-11-07T01:05:58Z

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

- 2026-11-07T01:02:54Z — P5-06 — opencode — Add golden and API integration tests for create/edit/delete and the resulting rendered `pjsip.conf`/`extensions.conf`. — commit: 68a6e88 — phase 5 integration tests
- 2026-11-07T01:03:41Z — P6-01 — opencode — Inbound routes API/UI: DID or pattern matching, optional trunk filter, caller-ID filter, and a destination picker shared across features. — commit: 60cc6f8 — implemented basic
- 2026-11-07T01:03:41Z — P6-02 — opencode — Ring groups: number, strategy (ringall/linear/rrmemory), members, ring time, and no-answer destination; render one Asterisk queue per group. — commit: 60cc6f8 — implemented basic
- 2026-11-07T01:03:41Z — P6-03 — opencode — IVRs: greeting prompt, timeout, retries, digit options, invalid/timeout destinations, and direct dial; reject cycles. — commit: 60cc6f8 — implemented basic
- 2026-11-07T01:05:26Z — P6-04 — opencode — Prompt management: built-in prompt browser/preview, upload, sox conversion to 8 kHz mono WAV, safe paths, duration and size limits. — commit: 8736991 — prompt upload endpoint
- 2026-11-07T01:05:35Z — P6-05 — opencode — Voicemail: per-extension mailbox and PIN, MWI, `*97`/`*98` feature codes, `/data/voicemail` spool verification, and message counts in the UI. — commit: 7968f42 — voicemail counts
- 2026-11-07T01:05:56Z — P6-06 — opencode — Implement and document remaining v1 feature codes (voicemail access, call pickup) with tests. — commit: cb747fb — feature codes + golden update
- 2026-11-07T01:05:58Z — P6-07 — opencode — Add a full-PBX renderer integration test covering inbound routes, ring groups, IVRs, prompts, and voicemail together. — commit: cb747fb — golden covers full fixture
