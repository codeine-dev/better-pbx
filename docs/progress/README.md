# Progress Tracking

This directory is the single source of truth for work-in-progress state. It is designed for multiple agents working concurrently in a shared repository.

## Why this exists

`PLAN.md` is stable: goals, architecture, decisions, and the phase map. It should rarely change. All mutable state — task checkboxes, ownership, claims, handoffs, and the worklog — lives here. That separation avoids merge conflicts on the plan and gives every agent one place to sync from.

## Files

| Path | Purpose | Written by |
| --- | --- | --- |
| `STATUS.md` | Generated dashboard: current focus, phase table, claims, blockers, next tasks. | `scripts/progress.mjs render` only |
| `phases/NN-*.md` | Canonical task checklists, exit criteria, verification commands, notes. | Agents working that phase |
| `claims/<task-id>.md` | Atomic claim for one task; includes owner, lease, branch, note. | `scripts/progress.mjs claim` |
| `WORKLOG.md` | Append-only record of completed tasks and commits. | `scripts/progress.mjs done` |
| `handoffs/<timestamp>-<agent>.md` | Session handoff: state, files, tests, next steps, blockers. | `scripts/progress.mjs handoff` + agent edits |

## Task format

Tasks live in phase files and must use this exact shape:

```md
- [ ] **P1-01** Build the multi-stage Dockerfile.
```

- ID format: `P<phase>-<two-digit sequence>`, e.g. `P0-01`, `P9-08`.
- IDs are global and unique.
- The script checks the prefix matches the phase number.
- Do not renumber or reuse IDs. Append new tasks with the next free number.

Phase frontmatter:

```yaml
---
phase: 1
title: Asterisk runtime image and boot
status: ready            # see status vocabulary in AGENTS.md
owner: null
branch: null
depends_on: [0]
updated: 2026-11-05T00:00:00Z
blocked_reason: null
---
```

## Daily workflow

```sh
# 1. Sync
git status
git pull --rebase

# 2. See what is ready
node scripts/progress.mjs status
node scripts/progress.mjs status --json

# 3. Claim one task (atomic; fails if already claimed)
node scripts/progress.mjs claim P0-01 --agent builder-1 --note "scaffolding workspace"

# 4. Do the work, run the phase verification commands

# 5. Complete
node scripts/progress.mjs done P0-01 --agent builder-1 --commit abc1234 --note "pnpm test green"

# 6. Render and verify before committing
node scripts/progress.mjs render
node scripts/progress.mjs check

# 7. Commit code + tracker
git add -A
git commit -m "feat(phase-0): scaffold workspace"
```

If you stop mid-task, keep the claim and write a handoff:

```sh
node scripts/progress.mjs handoff --agent builder-1
# edit docs/progress/handoffs/<file>.md
git add docs/progress && git commit -m "chore(progress): handoff P0-01"
```

## Concurrency model

- **Claims are per task.** The script creates `claims/<task-id>.md` with `O_EXCL`, so two agents cannot claim the same task in the same working tree.
- **Default lease is 8 hours.** Expired claims are reported by `check`; they are not deleted automatically. Confirm with the prior owner or the lead before using `--force`.
- **Shared working tree:** claims are visible immediately. Still commit them if the tree is shared via Git.
- **Separate worktrees:** commit and push the claim immediately after creating it, and rebase before status updates. A claim that only exists in an uncommitted worktree is invisible to other agents.
- **Phase-level coordination:** if tasks in the same phase touch the same files, sequence them. If tasks in different phases touch the same files, the phase files should call that out; otherwise split the files.
- **Generated dashboard:** `STATUS.md` is deterministic from phase files, claims, and the worklog. Never hand-edit it; run `render`. `check` fails if it is stale.

## Status derivation

- A phase is `done` when an agent sets it to `done` via `set-phase` after all its tasks are checked.
- `in_progress` is set automatically on the first claim.
- `blocked` is set manually with a reason.
- The dashboard shows dependency warnings if a phase is in progress before its dependencies are done. This is a warning, not a hard block, because some tasks can start early.

## Validation and CI

```sh
node scripts/progress.mjs check
```

This validates:

- unique, correctly prefixed task IDs;
- phase status vocabulary;
- claims reference real, unfinished tasks;
- claim file names match their task IDs;
- expired leases are surfaced;
- `STATUS.md` is up to date.

CI runs the same command. A stale dashboard or a malformed claim fails the build.

## Adding or changing tasks

- The lead agent may add tasks to a phase file with the next free ID.
- Agents may not delete tasks or renumber existing ones.
- If scope changes materially, update the phase file and add a note; if it affects architecture, update `PLAN.md` and add an ADR.
