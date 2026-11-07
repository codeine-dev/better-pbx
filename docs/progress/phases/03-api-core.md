---
phase: 3
title: API core, apply pipeline, and snapshots
status: in_progress
owner: opencode
branch: main
depends_on: [2]
updated: "2026-11-07T00:49:22Z"
blocked_reason: null
---

# Phase 3 — API core, apply pipeline, and snapshots

## Goal

Expose the config engine through a secure API, make every mutation transactional, and make Git snapshots/rollback real.

## Tasks

- [ ] **P3-01** Create the Fastify app with config, structured logging, error envelope, OpenAPI docs, and static SPA fallback.
- [ ] **P3-02** Add SQLite migrations for users, sessions, audit log, CDR index, and meta; add a migration command.
- [ ] **P3-03** Implement setup status/completion with the one-time setup code, admin creation, session login/logout, CSRF, login rate limiting, and the setup gate middleware.
- [ ] **P3-04** Implement the Git manager: init, commit, list, show, diff, restore, clean status, session author, safe argument handling.
- [ ] **P3-05** Implement the apply pipeline: model lock, staging render, policy checks, atomic writes, reload classification, failure rollback, audit, and commit.
- [ ] **P3-06** Implement Asterisk and fail2ban CLI wrappers with timeouts, parsed output, and injectable runners for tests.
- [ ] **P3-07** Implement the internal ban endpoint, ban store with expiry, and sweeper.
- [ ] **P3-08** Implement the audit log for every mutation and rollback.
- [ ] **P3-09** Add integration tests using a temp `/data` and fake command runners: setup gate, auth, CRUD, commit, diff, rollback, CSRF, stale-write handling.

## Exit criteria

- A temp `/data` can be bootstrapped, set up, logged into, mutated, committed, diffed, and rolled back with no real Asterisk.
- Setup cannot be completed twice, without the token, or after another admin exists.
- Unauthenticated and CSRF-less mutations are rejected.
- Failed validation/render/reload leaves the previous configuration and commit intact.
- Every mutation produces exactly one audit entry and one snapshot on success.

## Verification

```sh
pnpm test
pnpm typecheck
node scripts/progress.mjs check
```

## Notes / decisions

- Setup completion must be atomic from the client's point of view: admin, model, initial commit, and session either all succeed or none do.
- The internal ban endpoint binds to loopback and requires `/data/runtime/internal-token`.
- Use `If-Match`/ETag with the Git HEAD SHA for optimistic concurrency.
- Never expose secrets after create/reset.

## Handoff

- Add notes here if the phase is stopped mid-way.
