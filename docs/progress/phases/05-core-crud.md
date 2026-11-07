---
phase: 5
title: Extensions, trunks, and outbound routing
status: ready
owner: null
branch: main
depends_on: [2, 3, 4]
updated: "2026-11-07T01:00:40Z"
blocked_reason: null
---

# Phase 5 — Extensions, trunks, and outbound routing

## Goal

Deliver the first complete telephony CRUD slice: a phone can register, a trunk can be reached, and outbound calls can be routed — all through validated forms that produce snapshotted config.

## Tasks

- [x] **P5-01** Extensions API/UI: number, display name, codecs, secret generate/reveal-once/reset, transport, NAT settings, max contacts, voicemail fields, enable/disable; enforce unique numbers.
- [x] **P5-02** Trunks API/UI: registration vs IP authentication, provider CIDRs, transport, TLS/SRTP, codecs, caller ID, from user/domain, outbound proxy; reject unauthenticated or `0.0.0.0/0` trust.
- [x] **P5-03** Outbound routes API/UI: dialplan patterns, strip/prepend, caller ID override, trunk selection, emergency route setting, premium/unsafe confirmation; reject catch-all patterns by default.
- [x] **P5-04** Add apply/reload feedback, dialplan overlap and conflict warnings, and delete guards for resources still referenced by routes.
- [x] **P5-05** Update the dashboard checklist as extensions, trunks, and routes are added.
- [ ] **P5-06** Add golden and API integration tests for create/edit/delete and the resulting rendered `pjsip.conf`/`extensions.conf`.

## Exit criteria

- Creating extension 101, a trunk, and a `_9NXXXXXX` route in the UI renders config that loads in Asterisk without errors.
- Each successful change creates exactly one Git snapshot and reloads the affected Asterisk module.
- Deleting a trunk still used by a route is blocked with a clear message.
- Secrets are returned only at creation/reset and are never present in list responses or logs.
- Unsafe trunks and catch-all routes are rejected by both API and UI.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm test:e2e
node scripts/progress.mjs check
```

## Notes / decisions

- Codec allow-list is enforced centrally: ulaw, alaw, gsm, g722 only.
- SIP secrets are generated server-side with sufficient entropy; strength is validated on manual entry.
- Outbound route ordering is explicit `priority`; the UI must make ordering obvious and deterministic.

## Handoff

- Add notes here if the phase is stopped mid-way.
