# BetterPBX

BetterPBX is a self-contained PBX appliance: Asterisk 22 LTS, a hardened configuration API, and a
React admin UI in a single Docker image. All persistent state lives under `/data`, and every
successful configuration change is snapshotted as a Git commit with diff and rollback.

> Status: Phase 0 (repository scaffold). The application is not runnable yet; the first working
> vertical slice is the Phase 1 runtime image. See [`PLAN.md`](PLAN.md) for the phase map.

## Goals

- **Asterisk 22 LTS** is the telephony engine. Legacy `chan_sip` is not supported.
- **Typed configuration, not raw files.** A versioned YAML model is validated and rendered into
  the Asterisk config tree. The API never exposes an editable raw config.
- **Everything is a snapshot.** Validate, render, apply, reload, then commit. Rollback restores the
  model and re-renders it.
- **Hardened by default.** Authenticated endpoints, no anonymous SIP, no catch-all outbound routes,
  restricted codecs, fail2ban always enabled, and enforced whitelist/blacklist.
- **One image.** `s6-overlay` supervises Asterisk, the API, and fail2ban.

## Quick start (development)

Prerequisites:

- Node.js 24+
- pnpm 10 (`corepack enable` is the recommended way to get the pinned version)

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the API and web dev servers once those packages exist. During Phase 0 the
workspace is intentionally empty, so the command exits after reporting that no dev server is
configured.

## Quality gates

Run the same commands CI runs:

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node scripts/progress.mjs check
```

| Script | Purpose |
| --- | --- |
| `pnpm lint` | ESLint 9 over every package. |
| `pnpm typecheck` | Strict TypeScript check via project references. |
| `pnpm test` | Vitest unit tests. |
| `pnpm test:e2e` | Playwright end-to-end tests (placeholder until Phase 4). |
| `pnpm build` | Build every package and the static UI bundle. |
| `pnpm docker:build` | Build the runtime image (available in Phase 1). |
| `pnpm dev` | Run local development servers. |

## Progress tracker

Work is tracked in `docs/progress/`. `PLAN.md` is the stable architecture; phase files are the
mutable checklists.

```sh
node scripts/progress.mjs status          # what is ready
node scripts/progress.mjs claim P0-02 --agent my-agent
node scripts/progress.mjs done  P0-02 --agent my-agent --commit <sha> --note "tests: pnpm test"
node scripts/progress.mjs render          # regenerate STATUS.md
node scripts/progress.mjs check           # validate tracker (CI runs this)
```

Never edit `docs/progress/STATUS.md` by hand. Claims are per task, and each file has one writer at
a time. See [`AGENTS.md`](AGENTS.md) and [`docs/progress/README.md`](docs/progress/README.md) for
the full working agreement.

## Repository layout

```
apps/
  api/                  Fastify server, auth, routes, snapshots
  web/                  React + Vite admin UI
packages/
  shared/               Zod schemas and API contracts
  config-engine/        Pure model validation, renderers, security policy
  test-fixtures/        Golden model and rendered-config fixtures
docker/
  asterisk/             Asterisk build inputs
  s6/                   Service definitions and one-shot init
  fail2ban/             Filter, jail, and action templates
scripts/                Progress tracker, smoke tests, backup/restore
docs/                   ADRs, deployment, security, upgrade notes
docs/progress/          Phase checklists, claims, handoffs, worklog
```

## Documentation

- [`PLAN.md`](PLAN.md) — architecture, decisions, and phase map.
- [`PROJECT.md`](PROJECT.md) — product requirements.
- [`docs/adr/0001-architecture.md`](docs/adr/0001-architecture.md) — the decisions this repository
  is built on.
- [`AGENTS.md`](AGENTS.md) — rules for human and AI contributors.

## Security

Security invariants are never traded away to make a test pass. If a requirement conflicts with an
invariant, stop and record the conflict rather than weakening the invariant.
