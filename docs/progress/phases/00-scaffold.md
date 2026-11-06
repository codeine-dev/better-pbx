---
phase: 0
title: Repository scaffold and decisions
status: done
owner: opencode
branch: main
depends_on: []
updated: "2026-11-06T00:11:17Z"
blocked_reason: null
---

# Phase 0 — Repository scaffold and decisions

## Goal

Turn the greenfield repository into a working TypeScript monorepo with one command per quality gate, and capture the architecture decisions that later agents must follow.

## Tasks

- [x] **P0-01** Write `README.md` skeleton and `docs/adr/0001-architecture.md` (condensed from `PLAN.md`).
- [x] **P0-02** Create the pnpm workspace, strict TypeScript config, package layout (`apps/api`, `apps/web`, `packages/shared`, `packages/config-engine`, `packages/test-fixtures`), ESLint 9, Prettier, Vitest.
- [x] **P0-03** Add root scripts: `lint`, `typecheck`, `test`, `test:e2e`, `build`, `dev`, `docker:build`; keep the progress scripts.
- [x] **P0-04** Add CI workflow for install, lint, typecheck, unit tests, and build; keep the progress workflow.
- [x] **P0-05** Add `.gitignore`, `.editorconfig`, and `.dockerignore`; ensure generated artifacts, local data, and secrets are ignored.

## Exit criteria

- `pnpm install` succeeds from a clean checkout.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes on the empty workspace.
- `node scripts/progress.mjs check` passes.
- `README.md` tells a new contributor how to run the tracker and the quality gates.
- The ADR records the model+renderer, snapshot, runtime, and security decisions.

## Verification

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node scripts/progress.mjs check
```

## Notes / decisions

- `PLAN.md` is stable architecture; this file is the mutable checklist.
- Do not add application features in this phase; only scaffolding and decisions.
- The first real vertical slice is Phase 1.

## Handoff

- Add notes here if the phase is stopped mid-way.
