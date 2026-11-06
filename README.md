# BetterPBX

BetterPBX is a self-contained PBX appliance: Asterisk 22 LTS, a hardened configuration API, and a
React admin UI in a single Docker image. All persistent state lives under `/data`, and every
successful configuration change is snapshotted as a Git commit with diff and rollback.

> Status: Phase 1 (Asterisk runtime image and boot). The container boots Asterisk 22 LTS,
> fail2ban, and a placeholder API under s6 with persistent `/data`. The configuration model,
> renderer, and setup wizard arrive in Phases 2–4. See [`PLAN.md`](PLAN.md) for the phase map.

## Goals

- **Asterisk 22 LTS** is the telephony engine. Legacy `chan_sip` is not supported.
- **Typed configuration, not raw files.** A versioned YAML model is validated and rendered into
  the Asterisk config tree. The API never exposes an editable raw config.
- **Everything is a snapshot.** Validate, render, apply, reload, then commit. Rollback restores the
  model and re-renders it.
- **Hardened by default.** Authenticated endpoints, no anonymous SIP, no catch-all outbound routes,
  restricted codecs, fail2ban always enabled, and enforced whitelist/blacklist.
- **One image.** `s6-overlay` supervises Asterisk, the API, and fail2ban.

## Quick start (container)

Prerequisites:

- Docker with BuildKit
- Ports 5060/udp, 5061/tcp, 8080/tcp, and 10000–20000/udp available on the host

Build and run the Phase 1 runtime image:

```sh
docker build -t better-pbx:dev .
docker run --name better-pbx --network=host -v better-pbx:/data better-pbx:dev
```

The image is deliberately run with `--network=host` so SIP and RTP use predictable ports rather
than a large Docker port mapping. Watch the first boot:

```sh
docker logs -f better-pbx
```

The log contains `FIRST-RUN SETUP CODE: ....` (also stored at `/data/setup-token`). Enter that code
when the setup wizard lands in Phase 4. The token is removed after setup and survives container
restarts until then. For automated provisioning, set `PBX_SETUP_TOKEN` on the first run.

The placeholder API exposes:

- `GET /api/health`
- `GET /api/setup/status`
- `GET /`

Asterisk is configured with UDP and TLS transports but **no endpoints**, so it accepts no calls
until configuration exists. AMI, ARI, and Asterisk's internal HTTP server are disabled.

Useful checks:

```sh
docker exec better-pbx asterisk -rx 'core show version'
docker exec better-pbx fail2ban-client status
curl http://127.0.0.1:8080/api/health
```

### Persistent data

All mutable state lives under `/data`:

```
/data
├── config/          Git repository: pbx.yaml and the rendered Asterisk tree
├── voicemail/       voicemail spool
├── sounds/          uploaded prompts (custom sound directory)
├── runtime/         tokens, TLS material, generated PJSIP ACL
├── log/             messages, security log for fail2ban, CDR CSV
└── fail2ban/        fail2ban state
```

`/etc/asterisk` is a symlink to `/data/config/asterisk`, and the bootstrap configuration is
committed to `/data/config` on first boot. Restarting the container against the same volume never
overwrites the operator's model, TLS material, tokens, or Git history.

### Development shell

The Node.js monorepo is still developing; the web shell is the only local dev server today:

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the web shell on <http://localhost:5173>. The API dev server and configuration
engine are added in Phases 2–3.

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
| `pnpm typecheck` | Strict TypeScript check across every workspace package. |
| `pnpm test` | Vitest unit tests. |
| `pnpm test:e2e` | Playwright end-to-end tests (placeholder until Phase 4). |
| `pnpm build` | Build every package and the static UI bundle. |
| `pnpm format` / `pnpm format:check` | Apply or verify Prettier formatting. |
| `pnpm docker:build` | Build the runtime image. |
| `scripts/smoke-container.sh` | Build, boot, health-check, restart, and gracefully stop the container. |
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
