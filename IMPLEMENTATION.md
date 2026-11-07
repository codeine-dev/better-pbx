# BetterPBX Implementation

Status: implementation in progress (Phases 0-8 complete; Phase 9 partial).

## Verification evidence

- `pnpm lint` — clean
- `pnpm typecheck` — all packages pass
- `pnpm test` — 77 tests pass
- `pnpm build` — all packages and web bundle build
- Golden config validated against a throwaway Asterisk 22 instance
- Progress tracker: `node scripts/progress.mjs check` passes

## Deviations from PLAN.md

- Native modules avoided: SQLite uses Node 24 built-in `node:sqlite`; password hashing uses `node:crypto` Argon2id instead of the `argon2` npm package.
- Prompt upload uses JSON base64 instead of multipart; sox conversion runs via child_process.
- Optional nftables bans (P7-06) not implemented; API-only ban path is the default.
- Docker E2E and SIP smoke tests are scripts/placeholders pending a Docker environment.

## Known limitations

- Playwright tests require browser installation and a running container; not run in this environment.
- CDR ingestion is a minimal CSV tail; full parsing not implemented.
- Pending-restart banner and "apply when idle" flow are partial (restartRequired is returned by apply).
- Multi-step setup wizard defaults detection (timezone/locale) is minimal in the UI.
- Voicemail-to-email remains out of scope per PLAN.md.