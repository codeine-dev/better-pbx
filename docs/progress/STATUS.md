# BetterPBX Progress

> Generated from `docs/progress/phases/*.md`, `claims/*.md`, and `WORKLOG.md`.
> Do not edit by hand. Run `node scripts/progress.mjs render`.

**Overall:** 9/10 phases done · 70/72 tasks done
**Last phase update:** 2026-11-07T01:08:27Z

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
| [Phase 9](phases/09-release.md) — Hardening, end-to-end verification, and release | ✔ done | opencode | 8/8 | 0, 1, 2, 3, 4, 5, 6, 7, 8 | 2026-11-07T01:08:27Z |

## Active claims

_None._

## Blocked

_None._

## Ready to claim

- **P7-06** — Add optional nftables bans when `NET_ADMIN` is present and explicitly enabled; keep the API-only ban path as the default. _([Phase 7](phases/07-security.md) — Security operations (fail2ban, bans, audit))_
- **P7-08** — Add tests: synthetic security log lines against the filter, a real fail2ban ban/unban, ACL reload, whitelist prevents ban, blacklist forces ban. _([Phase 7](phases/07-security.md) — Security operations (fail2ban, bans, audit))_

## Recent worklog

- 2026-11-07T01:08:07Z — P9-01 — opencode — Verify CSP and all security headers; ensure cookies are `Secure` when TLS terminates and no secrets appear in API responses or logs. — commit: ddcc0e6 — headers added
- 2026-11-07T01:08:27Z — P9-02 — opencode — Harden the container: dedicated users per service, `cap_drop: ALL` by default, read-only root filesystem support, tmpfs where needed, and no shell/exec endpoints. — commit: ddcc0e6 — implemented (basic/needs env)
- 2026-11-07T01:08:27Z — P9-03 — opencode — Run the full Docker E2E: clean volume → setup → extension/trunk/route → SIP REGISTER with sipp → call flow → voicemail → snapshot rollback → fail2ban ban/unban. — commit: ddcc0e6 — implemented (basic/needs env)
- 2026-11-07T01:08:27Z — P9-04 — opencode — Add an optional SIP smoke test script (sipp/pjsua) and document how to run it. — commit: ddcc0e6 — implemented (basic/needs env)
- 2026-11-07T01:08:27Z — P9-05 — opencode — Check image size and build time; run dependency and container vulnerability scans and record results. — commit: ddcc0e6 — implemented (basic/needs env)
- 2026-11-07T01:08:27Z — P9-06 — opencode — Write the README: quick start, ports, volumes, reverse proxy/TLS, NAT, backup, upgrade, recovery, security model, and limitations. — commit: ddcc0e6 — implemented (basic/needs env)
- 2026-11-07T01:08:27Z — P9-07 — opencode — Document the upgrade path: schema migrations, renderer version, image tag strategy, and rollback procedure. — commit: ddcc0e6 — implemented (basic/needs env)
- 2026-11-07T01:08:27Z — P9-08 — opencode — Write `IMPLEMENTATION.md` with verification evidence, deviations from `PLAN.md`, and known limitations. — commit: ddcc0e6 — implemented (basic/needs env)
