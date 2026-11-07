# BetterPBX Progress

> Generated from `docs/progress/phases/*.md`, `claims/*.md`, and `WORKLOG.md`.
> Do not edit by hand. Run `node scripts/progress.mjs render`.

**Overall:** 3/10 phases done · 21/72 tasks done
**Last phase update:** 2026-11-07T00:43:50Z

## Current focus

- No phase is currently in progress.

## Phases

| Phase | Status | Owner | Tasks | Depends on | Updated |
| --- | --- | --- | --- | --- | --- |
| [Phase 0](phases/00-scaffold.md) — Repository scaffold and decisions | ✔ done | opencode | 5/5 | — | 2026-11-06T00:11:17Z |
| [Phase 1](phases/01-runtime.md) — Asterisk runtime image and boot | ✔ done | opencode | 8/8 | 0 | 2026-11-06T00:58:39Z |
| [Phase 2](phases/02-config-engine.md) — Configuration model and renderer | ✔ done | opencode | 8/8 | 1 | 2026-11-07T00:43:50Z |
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

- 2026-11-06T23:47:08Z — P2-01 — opencode — Implement `packages/shared`: full Zod model, destination union, defaults for every resource, schema version and migration hook. — commit: ed82ed1 — shared Zod model: settings/region/network/security/voicemail, all resources, destination union, per-resource factories, CIDR/primitives, schema migrations; pnpm test 16 shared tests green
- 2026-11-06T23:52:44Z — P2-02 — opencode — Implement deterministic renderers for every file in `PLAN.md` §3.2 (`asterisk.conf`, `pjsip.conf`, `extensions.conf`, `queues.conf`, `voicemail.conf`, `logger.conf`, `rtp.conf`, `indications.conf`, `features.conf`, `modules.conf`, `cdr.conf`, `musiconhold.conf`, fail2ban config). — commit: fe543ff — renderers for asterisk.conf, pjsip, extensions, queues, voicemail, logger, rtp, indications, features, modules, cdr, musiconhold, safety files and fail2ban; deterministic sorted tree; renderer tests green
- 2026-11-07T00:26:01Z — P2-03 — opencode — Implement the security policy: endpoint auth, trunk trust, codec allow-list, catch-all route rejection, premium prefix policy, secret strength, CIDR validation, ACL generation. — commit: 543822b — security policy: auth/trunk trust, codec/CIDR validation, catch-all and premium route rejection, secret strength, named acl.conf ACL with whitelist/blacklist/bans; renderSecure pipeline and rendered-config scan; 9 policy tests
- 2026-11-07T00:28:56Z — P2-04 — opencode — Implement the dialplan pattern parser/validator (`_N`, `_X`, `_Z`, ranges, `.`, `!`, literals), conflict/overlap detection, and emergency-route generation. — commit: 5028ebe — Asterisk pattern parser (X/Z/N, ranges, . and !, literals), catch-all classification, representative samples, outbound conflict detection, dedicated emergency-route generation; 10 dialplan tests
- 2026-11-07T00:32:00Z — P2-05 — opencode — Implement cross-resource validation: unique numbers/slugs, existing references, IVR/ring-group cycles, prompt existence, inbound destinations. — commit: e8094c2 — validateModel/assertValidModel: schema migration, security policy, unique IDs/numbers/names, reference resolution, destination cycles, prompt existence, duplicate DIDs, pattern conflicts; 9 validation tests
- 2026-11-07T00:35:08Z — P2-06 — opencode — Create the complete golden fixture covering every feature and snapshot every rendered file. — commit: 20440ad — complete fixture covers all resources and optional fields; 27 golden files under packages/test-fixtures/golden; golden test checks exact file set and contents, plus pnpm golden:update
- 2026-11-07T00:35:46Z — P2-07 — opencode — Add unit tests for defaults, validation failures, dangerous patterns, ACL ordering, and secret generation. — commit: e9c3fad — 11 unit tests covering defaults, field-level validation failures, dangerous/premium patterns, ACL ordering, and secret generation; suite now 65 tests
- 2026-11-07T00:43:50Z — P2-08 — opencode — Implement the temporary-Asterisk validator (alternate ports, temp dirs) and use it in the golden test. — commit: 90f1a46 — throwaway Asterisk validator on alternate ports/temp dirs; checks PJSIP endpoints, dialplan, error-level logs, and fail2ban-client -t; pnpm validate:golden passed against better-pbx:dev
