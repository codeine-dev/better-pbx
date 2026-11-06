---
phase: 4
title: Frontend shell and setup wizard
status: not_started
owner: null
branch: null
depends_on: [3]
updated: 2026-11-05T00:00:00Z
blocked_reason: null
---

# Phase 4 — Frontend shell and setup wizard

## Goal

Give the product a real admin experience: a forced first-run wizard, a secure login, and an app shell with navigation, state, and the primitives every later screen reuses.

## Tasks

- [ ] **P4-01** Build the Vite/React/Tailwind/shadcn base: router, query client, typed API client with CSRF and ETag/`If-Match` handling, shared Zod schemas from `packages/shared`.
- [ ] **P4-02** Implement the login page, auth guard, forced `/setup` redirect, and the setup-code step; no other route is usable before setup completes.
- [ ] **P4-03** Implement the multi-step setup wizard with detected defaults (timezone, locale, network interfaces, emergency numbers, language) and an "accept defaults" path; only the admin password is mandatory.
- [ ] **P4-04** Build the app shell: sidebar, header, responsive navigation, light/dark theme, and a dashboard skeleton with service status cards and a setup checklist.
- [ ] **P4-05** Add the shared UI primitives: error/toast/dialog/table/form components, loading skeletons, empty states, unsaved-change guard, and accessible focus handling.
- [ ] **P4-06** Add Playwright coverage for first-run setup (happy path and validation errors), login, logout, and the forced-setup guard.

## Exit criteria

- With a real container and a fresh volume, setup completes end to end in a browser.
- No API-backed screen other than setup/health renders or is reachable before setup.
- The setup code is required; every wizard field except the admin password has a usable default.
- The app shell is keyboard accessible and responsive at mobile/tablet/desktop widths.
- Playwright setup/auth tests pass against the container.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm test:e2e
node scripts/progress.mjs check
```

## Notes / decisions

- The frontend never renders or edits raw Asterisk config; forms are driven by shared schemas.
- Setup must be resumable after a validation error without losing entered values.
- Do not add feature screens here beyond the dashboard skeleton; CRUD screens belong to Phases 5–7.

## Handoff

- Add notes here if the phase is stopped mid-way.
