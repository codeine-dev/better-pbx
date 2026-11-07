---
phase: 2
title: Configuration model and renderer
status: done
owner: opencode
branch: main
depends_on: [1]
updated: "2026-11-07T00:43:50Z"
blocked_reason: null
---

# Phase 2 — Configuration model and renderer

## Goal

Build the pure TypeScript core that turns a validated model into deterministic, hardened Asterisk configuration. This is the heart of the product; no UI or API work should bypass it.

## Tasks

- [x] **P2-01** Implement `packages/shared`: full Zod model, destination union, defaults for every resource, schema version and migration hook.
- [x] **P2-02** Implement deterministic renderers for every file in `PLAN.md` §3.2 (`asterisk.conf`, `pjsip.conf`, `extensions.conf`, `queues.conf`, `voicemail.conf`, `logger.conf`, `rtp.conf`, `indications.conf`, `features.conf`, `modules.conf`, `cdr.conf`, `musiconhold.conf`, fail2ban config).
- [x] **P2-03** Implement the security policy: endpoint auth, trunk trust, codec allow-list, catch-all route rejection, premium prefix policy, secret strength, CIDR validation, ACL generation.
- [x] **P2-04** Implement the dialplan pattern parser/validator (`_N`, `_X`, `_Z`, ranges, `.`, `!`, literals), conflict/overlap detection, and emergency-route generation.
- [x] **P2-05** Implement cross-resource validation: unique numbers/slugs, existing references, IVR/ring-group cycles, prompt existence, inbound destinations.
- [x] **P2-06** Create the complete golden fixture covering every feature and snapshot every rendered file.
- [x] **P2-07** Add unit tests for defaults, validation failures, dangerous patterns, ACL ordering, and secret generation.
- [x] **P2-08** Implement the temporary-Asterisk validator (alternate ports, temp dirs) and use it in the golden test.

## Exit criteria

- The complete fixture renders all expected files with no nondeterminism.
- A deliberately unsafe model is rejected with actionable field-level errors.
- The golden config starts in a throwaway Asterisk and reports the expected endpoints/dialplan.
- `pnpm test` is green.
- Renderer files are pure and contain no filesystem or process access.

## Verification

```sh
pnpm test
pnpm typecheck
node scripts/progress.mjs check
```

## Notes / decisions

- The renderer must never emit anonymous endpoints, catch-all outbound routes, or unauthenticated trunks.
- `astspooldir=/data` is what places voicemail at `/data/voicemail`.
- Runtime ban state is not part of the committed model; renderers accept it as a separate optional input.
- Golden files are reviewed as code; a change to them is a product change. Refresh them with
  `pnpm golden:update` and review the diff before committing.
- Named PJSIP ACLs live in `asterisk/acl.conf` (included from `/data/runtime/pjsip-acl.conf`), not in
  `pjsip.conf`. Endpoints reference the ACL with `acl = global-acl`.
- `pnpm validate:golden` materialises the golden tree in `/tmp/opencode/pbx-validator-*`, starts
  Asterisk 22 from `better-pbx:dev` on alternate ports 15060/15061 with RTP 20000–20100, checks
  endpoints and dialplan, runs `fail2ban-client -t`, and removes the container. Docker and the
  built image are required for the real check; CI without them records `unavailable` instead of
  failing the pure test suite.

## Handoff

- Add notes here if the phase is stopped mid-way.
