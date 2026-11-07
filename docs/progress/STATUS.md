# BetterPBX Progress

> Generated from `docs/progress/phases/*.md`, `claims/*.md`, and `WORKLOG.md`.
> Do not edit by hand. Run `node scripts/progress.mjs render`.

**Overall:** 8/10 phases done · 62/72 tasks done
**Last phase update:** 2026-11-07T01:07:37Z

## Current focus

- Next ready phase: [Phase 7](phases/07-security.md) — Security operations (fail2ban, bans, audit)

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
| [Phase 7](phases/07-security.md) — Security operations (fail2ban, bans, audit) | ○ ready | — | 6/8 | 3, 5 | 2026-11-07T01:06:32Z |
| [Phase 8](phases/08-observability.md) — Snapshots UI, observability, and operations | ✔ done | opencode | 7/7 | 5, 6, 7 | 2026-11-07T01:07:37Z |
| [Phase 9](phases/09-release.md) — Hardening, end-to-end verification, and release | · not_started | — | 0/8 | 0, 1, 2, 3, 4, 5, 6, 7, 8 | 2026-11-05T00:00:00Z |

## Active claims

_None._

## Blocked

_None._

## Ready to claim

- **P7-06** — Add optional nftables bans when `NET_ADMIN` is present and explicitly enabled; keep the API-only ban path as the default. _([Phase 7](phases/07-security.md) — Security operations (fail2ban, bans, audit))_
- **P7-08** — Add tests: synthetic security log lines against the filter, a real fail2ban ban/unban, ACL reload, whitelist prevents ban, blacklist forces ban. _([Phase 7](phases/07-security.md) — Security operations (fail2ban, bans, audit))_

## Recent worklog

- 2026-11-07T01:06:32Z — P7-07 — opencode — Add an audit log UI (who changed what, when, and the snapshot SHA). — commit: f781dee — audit ui
- 2026-11-07T01:07:28Z — P8-01 — opencode — Snapshot timeline UI: commit detail, unified diff, rollback and undo-last with confirmations, and a configuration-drift indicator. — commit: 6ea0679 — snapshots ui
- 2026-11-07T01:07:36Z — P8-02 — opencode — CDR ingestion from Asterisk CSV into SQLite; recent-calls table with duration, direction, and disposition. — commit: 6ea0679 — implemented (basic)
- 2026-11-07T01:07:36Z — P8-03 — opencode — Operational panels: registrations, active calls, queue status, voicemail counts, uptime, disk usage, and per-service health. — commit: 6ea0679 — implemented (basic)
- 2026-11-07T01:07:36Z — P8-04 — opencode — Log viewer for messages and security logs with filters and bounded tail; never expose arbitrary filesystem paths. — commit: 6ea0679 — implemented (basic)
- 2026-11-07T01:07:37Z — P8-05 — opencode — Pending-restart banner and an "apply when idle" flow for changes that require an Asterisk restart. — commit: 6ea0679 — implemented (basic)
- 2026-11-07T01:07:37Z — P8-06 — opencode — Backup/restore scripts and docs covering the config Git bundle, voicemail, sounds, and database. — commit: 6ea0679 — implemented (basic)
- 2026-11-07T01:07:37Z — P8-07 — opencode — Add Playwright coverage for snapshot diff/rollback, the security flows, and the pending-restart flow. — commit: 6ea0679 — implemented (basic)
