---
phase: 8
title: Snapshots UI, observability, and operations
status: done
owner: opencode
branch: main
depends_on: [5, 6, 7]
updated: "2026-11-07T01:07:37Z"
blocked_reason: null
---

# Phase 8 — Snapshots UI, observability, and operations

## Goal

Make the appliance understandable and recoverable: visible history with rollback, real call/registration/queue visibility, bounded log access, and tested backup/restore.

## Tasks

- [x] **P8-01** Snapshot timeline UI: commit detail, unified diff, rollback and undo-last with confirmations, and a configuration-drift indicator.
- [x] **P8-02** CDR ingestion from Asterisk CSV into SQLite; recent-calls table with duration, direction, and disposition.
- [x] **P8-03** Operational panels: registrations, active calls, queue status, voicemail counts, uptime, disk usage, and per-service health.
- [x] **P8-04** Log viewer for messages and security logs with filters and bounded tail; never expose arbitrary filesystem paths.
- [x] **P8-05** Pending-restart banner and an "apply when idle" flow for changes that require an Asterisk restart.
- [x] **P8-06** Backup/restore scripts and docs covering the config Git bundle, voicemail, sounds, and database.
- [x] **P8-07** Add Playwright coverage for snapshot diff/rollback, the security flows, and the pending-restart flow.

## Exit criteria

- A change can be viewed as a diff, rolled back, and observed reloading Asterisk from the UI.
- Recent calls, registrations, queue status, and voicemail counts populate from real data.
- Logs are viewable with filters and cannot be used to read outside `/data/log`.
- Pending-restart changes are clearly surfaced and applied only when no active calls remain (or via an explicit override).
- Backup/restore docs are verified by restoring a test volume.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm test:e2e
node scripts/progress.mjs check
```

## Notes / decisions

- Rollback restores the model and re-renders; it never checks out stale rendered files blindly.
- Rollback history is append-only: rolling back creates a new commit.
- Read-only config viewing is allowed; raw editing is not.

## Handoff

- Add notes here if the phase is stopped mid-way.
