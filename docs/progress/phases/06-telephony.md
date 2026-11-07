---
phase: 6
title: Inbound routing, ring groups, IVRs, and voicemail
status: done
owner: opencode
branch: main
depends_on: [2, 5]
updated: "2026-11-07T01:05:58Z"
blocked_reason: null
---

# Phase 6 — Inbound routing, ring groups, IVRs, and voicemail

## Goal

Complete the call-flow feature set so a real inbound call can reach an extension, ring group, IVR, or voicemail, and messages persist under `/data/voicemail`.

## Tasks

- [x] **P6-01** Inbound routes API/UI: DID or pattern matching, optional trunk filter, caller-ID filter, and a destination picker shared across features.
- [x] **P6-02** Ring groups: number, strategy (ringall/linear/rrmemory), members, ring time, and no-answer destination; render one Asterisk queue per group.
- [x] **P6-03** IVRs: greeting prompt, timeout, retries, digit options, invalid/timeout destinations, and direct dial; reject cycles.
- [x] **P6-04** Prompt management: built-in prompt browser/preview, upload, sox conversion to 8 kHz mono WAV, safe paths, duration and size limits.
- [x] **P6-05** Voicemail: per-extension mailbox and PIN, MWI, `*97`/`*98` feature codes, `/data/voicemail` spool verification, and message counts in the UI.
- [x] **P6-06** Implement and document remaining v1 feature codes (voicemail access, call pickup) with tests.
- [x] **P6-07** Add a full-PBX renderer integration test covering inbound routes, ring groups, IVRs, prompts, and voicemail together.

## Exit criteria

- A complete fixture starts in Asterisk with no config errors.
- An inbound DID reaches an extension, a ring group, and an IVR; IVR digits route; an unanswered call falls through to voicemail.
- A recorded message appears under `/data/voicemail` and survives a container restart.
- MWI is configured for voicemail-enabled extensions.
- Cyclic IVR/ring-group destinations are rejected with actionable errors.
- Uploaded prompts are validated, converted, and stored only under `/data/sounds`.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm test:e2e
node scripts/progress.mjs check
```

## Notes / decisions

- Ring groups are Asterisk queues, not custom dialplan hacks.
- Destination references are a discriminated union validated cross-resource.
- Voice prompts are never served directly from arbitrary filesystem paths.
- Voicemail-to-email remains out of scope for v1; the model leaves room for it.

## Handoff

- Add notes here if the phase is stopped mid-way.
