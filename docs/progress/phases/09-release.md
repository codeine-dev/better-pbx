---
phase: 9
title: Hardening, end-to-end verification, and release
status: not_started
owner: null
branch: null
depends_on: [0, 1, 2, 3, 4, 5, 6, 7, 8]
updated: 2026-11-05T00:00:00Z
blocked_reason: null
---

# Phase 9 — Hardening, end-to-end verification, and release

## Goal

Prove the appliance as a whole, lock down the container and headers, document operations, and ship an image that matches the `PROJECT.md` deployment promise.

## Tasks

- [ ] **P9-01** Verify CSP and all security headers; ensure cookies are `Secure` when TLS terminates and no secrets appear in API responses or logs.
- [ ] **P9-02** Harden the container: dedicated users per service, `cap_drop: ALL` by default, read-only root filesystem support, tmpfs where needed, and no shell/exec endpoints.
- [ ] **P9-03** Run the full Docker E2E: clean volume → setup → extension/trunk/route → SIP REGISTER with sipp → call flow → voicemail → snapshot rollback → fail2ban ban/unban.
- [ ] **P9-04** Add an optional SIP smoke test script (sipp/pjsua) and document how to run it.
- [ ] **P9-05** Check image size and build time; run dependency and container vulnerability scans and record results.
- [ ] **P9-06** Write the README: quick start, ports, volumes, reverse proxy/TLS, NAT, backup, upgrade, recovery, security model, and limitations.
- [ ] **P9-07** Document the upgrade path: schema migrations, renderer version, image tag strategy, and rollback procedure.
- [ ] **P9-08** Write `IMPLEMENTATION.md` with verification evidence, deviations from `PLAN.md`, and known limitations.

## Exit criteria (whole project acceptance)

1. `docker build -t better-pbx .` succeeds and the image runs with the documented one-liner.
2. A fresh volume forces the setup wizard; the setup code is required; only the admin password has no default.
3. A softphone can register with the configured codecs; outbound, inbound, IVR, ring group, and voicemail all work.
4. Voicemail is stored under `/data/voicemail` and survives container replacement.
5. Every change produces a snapshot; diff and rollback work.
6. Failed registrations trigger fail2ban and a working SIP-layer ban; whitelist/blacklist behave as documented.
7. Lint, typecheck, unit, integration, Playwright, Docker smoke, and SIP smoke pass.
8. Docs cover deployment, security, backup, and recovery.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
scripts/smoke-container.sh
scripts/sip-smoke.sh
node scripts/progress.mjs check
```

## Notes / decisions

- Never weaken a security invariant to satisfy an acceptance item; record the deviation instead.
- The release image must pin Asterisk and Node versions; no floating tags.
- `IMPLEMENTATION.md` is the evidence trail, not a second plan.

## Handoff

- Add notes here if the phase is stopped mid-way.
