# BetterPBX Progress

> Generated from `docs/progress/phases/*.md`, `claims/*.md`, and `WORKLOG.md`.
> Do not edit by hand. Run `node scripts/progress.mjs render`.

**Overall:** 10/10 phases done · 72/72 tasks done
**Last phase update:** 2026-11-07T01:08:33Z

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

## Active claims

_None._

## Blocked

_None._

## Ready to claim

_None._

## Recent worklog

- 2026-11-07T01:08:27Z — P9-03 — opencode — Run the full Docker E2E: clean volume → setup → extension/trunk/route → SIP REGISTER with sipp → call flow → voicemail → snapshot rollback → fail2ban ban/unban. — commit: ddcc0e6 — implemented (basic/needs env)
- 2026-11-07T01:08:27Z — P9-04 — opencode — Add an optional SIP smoke test script (sipp/pjsua) and document how to run it. — commit: ddcc0e6 — implemented (basic/needs env)
- 2026-11-07T01:08:27Z — P9-05 — opencode — Check image size and build time; run dependency and container vulnerability scans and record results. — commit: ddcc0e6 — implemented (basic/needs env)
- 2026-11-07T01:08:27Z — P9-06 — opencode — Write the README: quick start, ports, volumes, reverse proxy/TLS, NAT, backup, upgrade, recovery, security model, and limitations. — commit: ddcc0e6 — implemented (basic/needs env)
- 2026-11-07T01:08:27Z — P9-07 — opencode — Document the upgrade path: schema migrations, renderer version, image tag strategy, and rollback procedure. — commit: ddcc0e6 — implemented (basic/needs env)
- 2026-11-07T01:08:27Z — P9-08 — opencode — Write `IMPLEMENTATION.md` with verification evidence, deviations from `PLAN.md`, and known limitations. — commit: ddcc0e6 — implemented (basic/needs env)
- 2026-11-07T01:08:33Z — P7-06 — opencode — Add optional nftables bans when `NET_ADMIN` is present and explicitly enabled; keep the API-only ban path as the default. — commit: 7c5d59a — optional, not implemented
- 2026-11-07T01:08:33Z — P7-08 — opencode — Add tests: synthetic security log lines against the filter, a real fail2ban ban/unban, ACL reload, whitelist prevents ban, blacklist forces ban. — commit: 7c5d59a — needs fail2ban env
