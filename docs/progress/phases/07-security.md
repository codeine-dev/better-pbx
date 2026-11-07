---
phase: 7
title: Security operations (fail2ban, bans, audit)
status: ready
owner: null
branch: main
depends_on: [3, 5]
updated: "2026-11-07T01:06:32Z"
blocked_reason: null
---

# Phase 7 — Security operations (fail2ban, bans, audit)

## Goal

Make the hardened defaults observable and operable: failed SIP registrations are banned at the SIP layer, admins can manage bans and ACLs safely, and every change is auditable.

## Tasks

- [x] **P7-01** Generate fail2ban jail/filter/action from settings; add the custom `pbx-ban` action that calls the loopback internal API.
- [x] **P7-02** Render the runtime PJSIP ACL include: whitelist permits, manual and automatic denies, safe fallback; reload PJSIP on change.
- [x] **P7-03** Bans API/UI: live bans with source/jail/expiry, unban, manual blacklist, whitelist override, and fail2ban status.
- [x] **P7-04** Security page: fail2ban tuning, whitelist/blacklist CRUD with CIDR validation and conflict rejection, login lockout status, and security audit checks.
- [x] **P7-05** Implement the expiry sweeper and startup reconciliation with fail2ban state so stale bans do not linger.
- [ ] **P7-06** Add optional nftables bans when `NET_ADMIN` is present and explicitly enabled; keep the API-only ban path as the default.
- [x] **P7-07** Add an audit log UI (who changed what, when, and the snapshot SHA).
- [ ] **P7-08** Add tests: synthetic security log lines against the filter, a real fail2ban ban/unban, ACL reload, whitelist prevents ban, blacklist forces ban.

## Exit criteria

- Injected failed registrations cause fail2ban to ban the IP; the ban is visible in the UI and enforced by the PJSIP ACL.
- Unban clears both the fail2ban state and the ACL entry.
- Whitelisting an IP immediately unbans it and prevents re-ban; blacklisting forces a ban even when fail2ban is idle.
- fail2ban cannot be disabled from the UI, and a whitelist/blacklist conflict is rejected.
- Audit entries exist for every mutation, rollback, and manual ban action.

## Verification

```sh
pnpm test
pnpm typecheck
scripts/security-smoke.sh
node scripts/progress.mjs check
```

## Notes / decisions

- The default ban path requires no extra capabilities: it updates the runtime PJSIP ACL via the API.
- `NET_ADMIN` and nftables are strictly optional and must never be required for the default hardened posture.
- Whitelist and blacklist entries are mutually exclusive per address range.

## Handoff

- Add notes here if the phase is stopped mid-way.
