---
phase: 1
title: Asterisk runtime image and boot
status: done
owner: opencode
branch: main
depends_on: [0]
updated: "2026-11-06T00:58:39Z"
blocked_reason: null
---

# Phase 1 — Asterisk runtime image and boot

## Goal

Prove the highest-risk integration first: one image that boots Asterisk 22 LTS, fail2ban, and a minimal API under s6, using persistent `/data` and a safe bootstrap config.

## Tasks

- [x] **P1-01** Build the multi-stage Dockerfile: Debian 13 builder, pinned Asterisk 22.x with SHA-256, bundled pjproject/jansson, curated `menuselect.makeopts`; runtime with Node 24, s6-overlay 3, fail2ban, git, sox, openssl, tzdata, SQLite.
- [x] **P1-02** Install core/extra sound packs (English by default; add other languages where packages exist), MOH, and verify paths.
- [x] **P1-03** Implement the s6 one-shot init: `/data` layout, `pbx`/`asterisk` users and groups, permissions, timezone, self-signed SIP TLS material, bootstrap model, Git init.
- [x] **P1-04** Write the static bootstrap Asterisk config: UDP/TLS transports, no endpoints, safe modules, disabled AMI/ARI/HTTP, security log, fail2ban baseline.
- [x] **P1-05** Add s6 services for Asterisk, fail2ban, and the placeholder API; define dependencies and restart behavior.
- [x] **P1-06** Add container healthcheck, stdout logging, graceful shutdown, and a clear first-boot setup-code message.
- [x] **P1-07** Write `scripts/smoke-container.sh` to build, run with a temporary `/data`, wait for health, and assert Asterisk/fail2ban/API.
- [x] **P1-08** Run the container smoke test, including a restart against the same `/data`, and record the result in the worklog/handoff.

## Exit criteria

- `docker build -t better-pbx:dev .` succeeds.
- `docker run --network=host -v /tmp/pbx:/data better-pbx:dev` starts and becomes healthy.
- Inside the container, `asterisk -rx "core show version"` reports Asterisk 22.x.
- `/api/health` returns OK; `fail2ban-client status` works.
- The setup code appears in container logs on the first boot and is removed after setup.
- Restarting the container reuses `/data` without reinitialising or corrupting config.
- No AMI/ARI/HTTP ports are exposed by Asterisk.

## Verification

```sh
docker build -t better-pbx:dev .
scripts/smoke-container.sh
docker run --rm --network=host -v /tmp/pbx:/data better-pbx:dev \
  sh -c 'for i in $(seq 1 90); do
           asterisk -rx "core show version" && fail2ban-client status && exit 0
           sleep 2
         done
         exit 1'
node scripts/progress.mjs check
```

## Notes / decisions

- Asterisk 22 is pinned; bump deliberately, never float `22-current` in a release image.
- `/etc/asterisk` is a symlink to `/data/config/asterisk`.
- Asterisk runs as `asterisk:pbx`; the API runs as `pbx:pbx`; fail2ban runs as root but uses a local API action by default.
- Bootstrap config must be safe with no endpoints, because setup is not complete yet.

## Handoff

- Add notes here if the phase is stopped mid-way.
