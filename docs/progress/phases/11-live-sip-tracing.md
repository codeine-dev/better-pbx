---
phase: 11
title: Live SIP tracing and log streaming in the Web UI
status: done
owner: opencode
branch: main
depends_on: [8, 10]
updated: "2026-11-07T19:43:58Z"
blocked_reason: null
---

# Phase 11 — Live SIP tracing and log streaming in the Web UI

## Goal

Make registration and call failures diagnosable from the admin console by surfacing live SIP protocol traces on the Logs page, with an explicit, opt-in tracer that never logs SIP traffic unless an admin turns it on.

## Tasks

- [x] **P11-01** Render a dedicated `sip` log channel (verbose/debug) and add API control for the PJSIP logger (`pjsip set logger on/off`).
- [x] **P11-02** Extend `/api/system/logs` to tail the SIP trace log (with a safe fallback to SIP-related messages lines) and bound the tail.
- [x] **P11-03** Rework the Logs page: SIP Traces tab, live polling, auto-scroll, and start/stop trace control.

## Exit criteria

- An admin can start a SIP trace from the Logs page and watch live REGISTER/INVITE traffic.
- Trace capture is opt-in; no SIP traffic is persisted by default.
- The tail endpoint cannot be used to read outside `/data/log`.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm lint
node scripts/progress.mjs check
```

## Notes / decisions

- SIP traces may contain credentials; the UI warns and defaults to off.
- The dedicated `sip.log` channel is declared in the rendered `logger.conf`; capture only happens when the PJSIP logger is enabled at runtime.

## Handoff

- Add notes here if the phase is stopped mid-way.