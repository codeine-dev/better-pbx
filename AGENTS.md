# BetterPBX — Agent Operating Rules

This repository is built by multiple agents, sometimes concurrently. Read this file before doing any work. It is the contract that keeps us from stepping on each other and from drifting away from `PLAN.md`.

## Product rules that must not be weakened

- Asterisk 22 LTS is the telephony engine; do not add legacy `chan_sip`.
- The API owns a typed model and renders Asterisk config. Do **not** add a raw Asterisk config editor.
- Every successful configuration change must be validated, applied, and snapshotted as a Git commit with diff and rollback.
- Hardened defaults are mandatory: authenticated endpoints, no anonymous SIP, no catch-all outbound routes by default, restricted codecs, fail2ban always enabled, whitelist/blacklist enforced.
- Voicemail lives at `/data/voicemail`; all persistent state lives under `/data`.
- The setup wizard is forced on an empty volume and is protected by a one-time setup code.
- Never weaken a security invariant just to make a test pass.

## Start-of-session checklist

1. Sync and inspect:
   ```sh
   git status
   git pull --rebase   # if a remote / shared branch exists
   ```
2. Read, in this order:
   - `PLAN.md` — stable architecture and phase map.
   - `docs/progress/STATUS.md` — generated live dashboard.
   - `docs/progress/README.md` — tracker mechanics.
   - The phase file you are about to work on.
3. Pick exactly one ready task and claim it:
   ```sh
   node scripts/progress.mjs claim P1-01 --agent <your-agent-name> --note "starting ..."
   ```
   If you use a separate worktree, immediately commit and push the claim so other agents can see it:
   ```sh
   git add docs/progress && git commit -m "chore(progress): claim P1-01"
   git push
   ```
4. Work only within the claimed task's scope. Do not edit another agent's phase file, claim, or files that the claim says are out of scope.
5. Run the phase verification commands before marking the task done.

## Completing a task

Use the script; it updates the phase checkbox, worklog, and dashboard atomically from the tracker's point of view:

```sh
node scripts/progress.mjs done P1-01 \
  --agent <your-agent-name> \
  --commit <sha-or-short-sha> \
  --note "tests: pnpm test; notes: ..."
```

Then commit your code together with `docs/progress`.

## Ending a session with unfinished work

1. Keep the claim (do not silently release it).
2. Write a handoff:
   ```sh
   node scripts/progress.mjs handoff --agent <your-agent-name>
   ```
3. Fill in current state, files changed, tests run, next steps, and blockers.
4. Commit the handoff and any work-in-progress that is safe to commit.
5. If the task is genuinely blocked, also do:
   ```sh
   node scripts/progress.mjs set-phase <n> blocked --note "reason"
   ```

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `not_started` | No work has begun. |
| `ready` | Dependencies are met; tasks may be claimed. |
| `in_progress` | At least one task is claimed or in flight. |
| `blocked` | Cannot proceed without a decision or external fix; reason in frontmatter. |
| `review` | Implementation done; awaiting verification or review. |
| `done` | All tasks checked; verification passed. |
| `parked` | Deliberately deferred. |

## Concurrency rules

- **One task, one claim.** Claims are files in `docs/progress/claims/<task-id>.md`, created exclusively by the script. If a claim exists, do not work on that task.
- **One writer per file.** If two tasks touch the same file, split the work or sequence it via claims/handoffs.
- **Never edit `STATUS.md` by hand.** It is generated:
  ```sh
  node scripts/progress.mjs render
  ```
- **Never rewrite history or force-push.**
- **Keep commits small and coherent.** Commit code and tracker updates together, but do not bundle unrelated tasks.
- **Do not renumber or delete task IDs.** Add new tasks with the next free ID in the phase file; note why.
- **Claims expire.** The default lease is 8 hours. If you find an expired claim, verify with the owner's handoff before using `--force` or asking the lead to release it.
- **If a decision changes,** update `PLAN.md` and add a short ADR under `docs/adr/`. Do not leave a decision only in chat.

## Definition of done

A task is done only when all of the following are true:

- The implementation is complete and consistent with surrounding patterns.
- Relevant unit/integration/E2E tests are added or updated.
- The phase's verification commands pass, or the exact command and reason it could not run is recorded in the handoff.
- Golden config fixtures are updated if rendered output changed.
- Security invariants still hold.
- The task checkbox is checked via the script, the worklog entry exists, and `STATUS.md` is rendered.
- No secrets, debug backdoors, or disabled security checks were introduced.

## Asking vs. proceeding

`PLAN.md` already records the product decisions. Proceed without asking on those. Stop and ask only when:

- A requirement in `PROJECT.md` conflicts with a security invariant.
- Two phases need incompatible changes to the same file.
- A destructive migration or data-loss risk is discovered.
- The user explicitly changes scope.

## Subagent instructions

When spawning a subagent:

- Give it the task ID, the phase file path, the exact scope/files it owns, and the verification command.
- Tell it to claim the task with a unique agent name and to use the tracker.
- Tell it not to spawn further agents unless explicitly authorized.
- Require a handoff if it stops before completion.

## Tracker commands

```sh
node scripts/progress.mjs status            # human summary
node scripts/progress.mjs status --json     # machine-readable
node scripts/progress.mjs check             # validate tracker; run in CI
node scripts/progress.mjs render            # regenerate STATUS.md
node scripts/progress.mjs claim <task> --agent <name>
node scripts/progress.mjs release <task> --agent <name>
node scripts/progress.mjs done <task> --agent <name> --commit <sha> --note "..."
node scripts/progress.mjs set-phase <n> <status> --note "..."
node scripts/progress.mjs handoff --agent <name>
```
