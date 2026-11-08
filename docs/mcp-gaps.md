# BetterPBX MCP Gaps and Improvement Backlog

Date: 2026-11-08

This document captures gaps in the BetterPBX MCP server (`apps/api/src/mcp.ts`) that limit an agent's ability to inspect, diagnose, and manage a BetterPBX instance. It is a backlog for future work; nothing here is implemented yet.

## Summary

The MCP server exposes a useful subset of read/debug and configuration tools, but it lags behind the REST API in CRUD completeness, diagnostics, TLS/certificate lifecycle, and log/audit querying. Agents can create resources and trigger full applies, but cannot safely iterate, inspect runtime state, or perform targeted troubleshooting without falling back to REST or shell access.

## 1. Incomplete CRUD parity

MCP has create/delete for most resources but almost no update/delete for several:

- Trunks: no `pbx_update_trunk` (only create/delete)
- Outbound/inbound routes: no update tools (only create/delete)
- Ring groups: no update/delete
- IVRs: no update/delete
- Prompts: no list/upload/delete tools at all (REST has `/api/prompts`)
- Music on hold: no tools (REST has `/api/music-on-hold`)
- Extensions: has update, but no "get by id" (only full list)

Impact: agents can build but not safely iterate or fix configurations.

## 2. Missing diagnostic / CLI surface

The API exposes useful Asterisk state that MCP does not:

- `pjsipShowEndpoints` (only contacts exposed)
- Channel details (only count exposed)
- Queues status (`/api/system/queues`)
- Voicemail counts (`/api/voicemail/counts`)
- Asterisk ping/version check
- Fail2ban status (`fail2ban status asterisk`) — only bans list exposed
- Safe, allowlisted module reloads (only full apply reloads exist)

Impact: debugging registrations, MWI, and call flow requires endpoint and queue state.

## 3. TLS and certificate lifecycle not exposed

REST has full TLS management; MCP has none:

- Certificate status, self-signed generation, upload, ACME, renew, validate
- SIP TLS transport is central to this deployment (TLS-only clients)

Impact: agents cannot diagnose or repair TLS/cipher failures seen in logs.

## 4. Log and audit querying is too shallow

- `pbx_logs_tail`: only tail plus fixed file aliases; no level/component/time filtering or search
- `pbx_audit_list`: no filters (actor/action/target/time), pagination, or search
- No "tail since timestamp"

Impact: large logs make root-cause analysis noisy.

## 5. No validation, dry-run, or apply-pending

- REST has `/api/system/apply-pending` and validation endpoints
- MCP forces a full apply for any change; no way to validate a model/config before committing
- No render preview or diff-before-apply

Impact: safer agent automation and rollback planning.

## 6. Resource and config discovery gaps

- `pbx_config_file` requires an exact path; no directory listing
- No way to read multiple related configs in one call
- Snapshot tools lack "list files at sha" / read file at sha (only diff/rollback)

## 7. Security and access context

- No `whoami` / current actor info
- No password change tool
- No security status endpoint (`/api/security/status`)
- Ban management only unban; no ban with reason/duration

## 8. Prompt and asset management entirely missing

- Prompts and MOH are model resources but MCP has no tools to list/upload/delete them
- Blocks IVR/MOH workflows for agents

## Recommended high-value additions (prioritized)

1. Update/delete tools for trunks, routes, ring groups, IVRs, prompts, MOH (parity).
2. `pbx_system_endpoints`, `pbx_system_queues`, `pbx_voicemail_counts`, `pbx_fail2ban_status`.
3. TLS tools: status, self-signed, validate, renew.
4. Log/audit filters: level, component, search, since, limit/offset.
5. `pbx_config_list`, `pbx_snapshot_files`, `pbx_validate_model`, `pbx_apply_pending`.
6. `pbx_asterisk_cli` (allowlisted commands) and `pbx_reload_module`.

## Notes

- Current workaround for missing reload: trigger a no-op update (e.g., extension displayName unchanged) to force `applyModel` reloads.
- Keep security invariants intact when implementing these additions; no raw Asterisk config editor.
