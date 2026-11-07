import { isCatchAllPattern } from '../dialplan/pattern.js';
import type { PolicyIssue, SecurityPolicyOptions } from './security.js';

function issue(code: string, path: string, message: string): PolicyIssue {
  return { code, path, message, severity: 'error' };
}

function parseSections(content: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current: string[] = [];
  for (const line of content.split('\n')) {
    const match = /^\[([^\]]+)\]\s*$/.exec(line);
    if (match?.[1] !== undefined) {
      current = [];
      sections.set(match[1], current);
    } else {
      current.push(line);
    }
  }
  return sections;
}

function hasLine(lines: string[], needle: string): boolean {
  return lines.some((line) => line.toLowerCase().includes(needle.toLowerCase()));
}

const FORBIDDEN_MODULES = [
  'app_system',
  'app_exec',
  'app_disa',
  'func_shell',
  'chan_sip',
  'res_ari',
  'res_manager',
  'res_pjsip_endpoint_identifier_anonymous',
];

/**
 * Final belt-and-braces pass over the rendered files. The renderer is trusted, but this catches
 * any future change that accidentally reintroduces an anonymous endpoint, a disabled security
 * control, or a catch-all outbound route.
 */
export function scanRenderedConfig(
  files: Record<string, string>,
  options: SecurityPolicyOptions = {},
): PolicyIssue[] {
  const issues: PolicyIssue[] = [];
  const pjsip = files['asterisk/pjsip.conf'] ?? '';
  const sections = parseSections(pjsip);

  if (/\[anonymous\]/i.test(pjsip) || /identify_by\s*=\s*anonymous/i.test(pjsip)) {
    issues.push(issue('anonymous-endpoint', 'asterisk/pjsip.conf', 'anonymous PJSIP endpoint detected'));
  }
  if (/auth_type\s*=\s*none/i.test(pjsip)) {
    issues.push(issue('no-auth', 'asterisk/pjsip.conf', 'unauthenticated PJSIP auth object detected'));
  }

  for (const [name, lines] of sections) {
    if (name.startsWith('endpoint-') && !hasLine(lines, 'auth =')) {
      issues.push(issue('no-auth', `asterisk/pjsip.conf[${name}]`, 'extension endpoint has no auth object'));
    }
    if (name.startsWith('trunk-') && !name.startsWith('trunk-aor-') && !name.startsWith('trunk-auth-') && !name.startsWith('trunk-reg-') && !name.startsWith('trunk-identify-')) {
      const id = name.slice('trunk-'.length);
      const identified = sections.has(`trunk-identify-${id}`);
      if (!hasLine(lines, 'auth =') && !hasLine(lines, 'outbound_auth =') && !identified) {
        issues.push(
          issue('unauthenticated-trunk', `asterisk/pjsip.conf[${name}]`, 'trunk endpoint has no trust boundary'),
        );
      }
    }
  }

  const dialplan = files['asterisk/extensions.conf'] ?? '';
  if (dialplan.length === 0) {
    issues.push(issue('missing-dialplan', 'asterisk/extensions.conf', 'dialplan was not rendered'));
  }
  const dialplanLines = dialplan.split('\n');
  for (let index = 0; index < dialplanLines.length; index += 1) {
    const match = /^\s*exten\s*=>\s*([^,]+),1,/.exec(dialplanLines[index] ?? '');
    if (match?.[1] === undefined) continue;
    const pattern = match[1].trim();
    const block: string[] = [];
    for (let next = index + 1; next < dialplanLines.length; next += 1) {
      const line = dialplanLines[next] ?? '';
      if (/^\s*exten\s*=>/.test(line) || /^\[[^\]]+\]/.test(line)) break;
      block.push(line);
    }
    if (block.some((line) => /Dial\(PJSIP\//.test(line))) {
      let catchAll = false;
      try {
        catchAll = isCatchAllPattern(pattern);
      } catch {
        // Special extensions (s, i, t, h) and non-outbound labels are not dialplan patterns.
      }
      if (catchAll && !options.allowCatchAllRoutes) {
        issues.push(
          issue('catch-all-route', 'asterisk/extensions.conf', `catch-all outbound pattern ${pattern} detected`),
        );
      }
    }
  }

  const logger = files['asterisk/logger.conf'] ?? '';
  if (!logger.includes('security => security')) {
    issues.push(issue('security-log-disabled', 'asterisk/logger.conf', 'fail2ban security log is not enabled'));
  }

  const modules = files['asterisk/modules.conf'] ?? '';
  if (!/autoload\s*=\s*no/.test(modules)) {
    issues.push(issue('autoload', 'asterisk/modules.conf', 'Asterisk module autoload must be disabled'));
  }
  for (const forbidden of FORBIDDEN_MODULES) {
    if (new RegExp(`load\\s*=\\s*${forbidden.replace('.', '\\.')}`, 'i').test(modules)) {
      issues.push(
        issue('forbidden-module', 'asterisk/modules.conf', `dangerous module ${forbidden} must not be loaded`),
      );
    }
  }

  const jail = files['fail2ban/jail.d/better-pbx.local'] ?? '';
  const jailSections = parseSections(jail);
  const jailBody = jailSections.get('better-pbx') ?? [];
  if (!hasLine(jailBody, 'enabled = true')) {
    issues.push(issue('fail2ban-disabled', 'fail2ban/jail.d/better-pbx.local', 'fail2ban jail must be enabled'));
  }
  if (!hasLine(jailBody, 'logpath')) {
    issues.push(issue('fail2ban-log', 'fail2ban/jail.d/better-pbx.local', 'fail2ban jail has no security log path'));
  }
  if (!hasLine(jailBody, 'filter = asterisk-security')) {
    issues.push(issue('fail2ban-filter', 'fail2ban/jail.d/better-pbx.local', 'fail2ban jail has the wrong filter'));
  }

  const acl = files['asterisk/acl.conf'] ?? '';
  if (!acl.includes('#include')) {
    issues.push(issue('acl-include', 'asterisk/acl.conf', 'runtime ACL include is missing'));
  }

  return issues;
}
