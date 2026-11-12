# Security Hardening Remediation Plan

Source review: `docs/security-hardening-plan.md` is the working plan for closing the gaps found in the Asterisk configuration and guardrail review.

## Goals
- Close config-injection, inert-guardrail, logging, TLS, ACL, and minor hardening gaps.
- Add a security regression test harness so every guardrail is continuously verified.
- Preserve compatibility unless a security invariant requires otherwise.

## Decisions (resolved)
1. **Network restrictions**: removed unused `localNetworks`/`remotePhone` fields.
2. **Media encryption**: SRTP now defaults on (SDES); DTLS remains opt-in.
3. **ACL precedence**: whitelist overrides automatic bans.
4. **callerIdFilter**: restricted to reject quotes, backslashes, newlines, and dollar signs.
5. **Voicemail PIN policy**: moderate policy (min 4 digits, no repeated/simple sequences).

## Phase 0 — Test harness (security regression suite)
Create tests before changing behavior:
- Config-engine injection tests (`packages/config-engine/src/policy/injection.test.ts`)
- Network guardrail tests (`packages/config-engine/src/policy/network.test.ts`)
- Rendered-config scan tests (`packages/config-engine/src/policy/rendered.test.ts`)
- Fail2ban synthetic log tests
- Golden fixture review workflow
- Throwaway Asterisk validation in CI where Docker is available

## Phase A — Config injection hardening (High)
- Replace `sanitizeValue` with context-aware escaping.
- Add schema constraints rejecting control characters in free-text fields.
- Restrict `callerIdFilter` to a safe subset.
- Add tests proving malicious values cannot create directives.

## Phase B — Enforce network restrictions (High)
- Implement or remove `localNetworks`/`remotePhone`.
- If implemented, enforce registration source restrictions and validate non-empty local networks when required.
- Add registration rejection tests.

## Phase C — Logging posture (Medium)
- Default logs to `notice,warning,error`.
- Make SIP debug logging opt-in.
- Add scan assertions for debug defaults.

## Phase D — TLS policy (Medium)
- Reject TLS versions below 1.2.
- Validate cipher strings.
- Document client-cert behavior.

## Phase E — ACL ordering (Medium)
- Verify Asterisk ACL evaluation with a live instance.
- Fix ordering if whitelist overrides bans unexpectedly.
- Add regression test.

## Phase F — Media encryption (Medium/Low)
- Keep opt-in by default; add hardened preset and warning.
- Consider default-on only after interop testing.

## Phase G — Voicemail PIN policy (Low)
- Enforce minimum entropy/length.
- Consider lockout behavior.

## Phase H — Minor cleanup (Low)
- Fix bootstrap PJSIP newline typo.
- Set `rtpchecksums = yes`.
- Restrict UDPTL unless T.38 is enabled.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- Throwaway Asterisk validation on golden and adversarial fixtures
- Fail2ban synthetic tests
- Container security smoke
- Manual rendered-config audit

## Success criteria
- No user-controlled value can introduce a newline or directive.
- Network restrictions are enforced or removed.
- Default logs have no debug/verbose SIP channels.
- Weak TLS versions cannot be selected.
- ACL ban behavior is verified and documented.
