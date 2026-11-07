---
phase: 10
title: Web UI coverage, configuration depth, and console polish
status: in_progress
owner: opencode
branch: main
depends_on: [4, 5, 6, 7, 8]
updated: "2026-11-07T11:20:37Z"
blocked_reason: null
---

# Phase 10 — Web UI coverage, configuration depth, and console polish

## Goal

Make every core PBX feature configurable from the admin UI, with full forms for existing resources (extensions, trunks, routes), and modernize the console with a Unifi-inspired dark theme.

## Tasks

- [ ] **P10-01** Define a Unifi-inspired dark design system: color tokens, sidebar, cards, status badges, inputs, toasts, empty states; default dark mode.
- [ ] **P10-02** Rework the app shell and navigation for all features (inbound routes, ring groups, IVRs, prompts, voicemail, settings) with active states and responsive layout.
- [ ] **P10-03** Type the web API client from shared schemas and add missing CRUD/patch helpers.
- [ ] **P10-04** Full extension configuration UI: secret generate/reveal-once/reset, codecs, transport, max contacts, remote phone, caller ID, enabled, and voicemail PIN/email.
- [ ] **P10-05** Full trunk configuration UI: auth credentials, codecs, inbound mode, provider CIDRs, from user/domain, caller ID, transport, port, enabled.
- [ ] **P10-06** Full outbound route configuration UI: priority, dialplan patterns (match/strip/prepend), caller ID, premium opt-in, trunk selection, enabled.
- [ ] **P10-07** Inbound routes UI with DID, trunk filter, caller-ID filter, and a shared destination picker.
- [ ] **P10-08** Ring groups UI: number, strategy, members, ring time, no-answer destination.
- [ ] **P10-09** IVR UI: greeting prompt, timeout, retries, digit options, timeout/invalid destinations, direct dial, cycle validation.
- [ ] **P10-10** Prompt management UI: browser, preview, upload with conversion status, delete.
- [ ] **P10-11** Voicemail UI: per-extension PIN/email, message counts, MWI status.
- [ ] **P10-12** Settings UI: region, network, security thresholds, whitelist/blacklist, voicemail limits.
- [ ] **P10-13** Dashboard overview with resource counts, registration/health summaries, and quick actions.
- [ ] **P10-14** Add Playwright coverage for the new configuration flows and the dark console shell.

## Exit criteria

- Every core resource can be created, edited, and deleted from the UI with full fields.
- Extension secrets can be generated, revealed once, and reset; codecs and transport are configurable.
- IVRs, ring groups, inbound routes, prompts, and voicemail are fully manageable in the UI.
- The console uses the new dark theme by default and remains responsive and keyboard accessible.
- Playwright covers the new flows.

## Verification

```sh
pnpm --filter @better-pbx/web typecheck
pnpm test
pnpm test:e2e
node scripts/progress.mjs check
```

## Notes / decisions

- Reuse shared Zod schemas for client-side validation.
- No raw Asterisk config editing; read-only viewer remains.

## Handoff

- Add notes here if the phase is stopped mid-way.
