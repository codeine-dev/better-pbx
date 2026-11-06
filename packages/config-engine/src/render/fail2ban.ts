import type { PbxModel } from '@better-pbx/shared';

import type { RenderPaths } from './types.js';

/** Structured Asterisk security events that fail2ban treats as authentication attacks. */
const FILTER = `[Definition]
failregex = ^.*SecurityEvent="(?:FailedACL|InvalidAccountID|ChallengeResponseFailed|InvalidPassword|MultipleSessionsForSameUser|HostILE|RejectedAuthentication|UnexpectedAddress)"[^\\n]*RemoteAddress="IPV4/(?:UDP|TCP)/<HOST>/\\d+"[^\\n]*$
ignoreregex =
`;

const ACTION = `[Definition]
actionstart =
actionstop =
actioncheck =
actionban = /usr/local/bin/pbx-ban ban <ip>
actionunban = /usr/local/bin/pbx-ban unban <ip>
`;

function ignoreList(model: PbxModel): string {
  return ['127.0.0.1/8', '::1', ...model.settings.security.whitelist].join(' ');
}

export function renderFail2banJail(model: PbxModel, paths: RenderPaths): string {
  const fail2ban = model.settings.security.fail2ban;
  return `[DEFAULT]
backend = polling
banaction = pbx-ban
banaction_allports = pbx-ban
bantime = ${fail2ban.banTime}
findtime = ${fail2ban.findTime}
maxretry = ${fail2ban.maxRetry}
bantime.increment = ${fail2ban.increment ? 'yes' : 'no'}
bantime.factor = 2
bantime.maxtime = 604800
ignoreip = ${ignoreList(model)}

[better-pbx]
enabled = true
filter = asterisk-security
logpath = ${paths.dataDir}/log/security
maxretry = ${fail2ban.maxRetry}
findtime = ${fail2ban.findTime}
bantime = ${fail2ban.banTime}

; The appliance image does not run sshd. Explicitly disable distro default jails so only the
; Asterisk security jail is active.
[sshd]
enabled = false
`;
}

export function renderFail2banLocal(paths: RenderPaths): string {
  return `[Definition]
dbfile = ${paths.dataDir}/fail2ban/fail2ban.sqlite3
logtarget = STDOUT
`;
}

/** Fail2ban configuration files. They are rendered, never edited by hand. */
export function renderFail2banTree(model: PbxModel, paths: RenderPaths): Record<string, string> {
  return {
    'fail2ban/action.d/pbx-ban.conf': ACTION,
    'fail2ban/fail2ban.d/better-pbx.local': renderFail2banLocal(paths),
    'fail2ban/filter.d/asterisk-security.conf': FILTER,
    'fail2ban/jail.d/better-pbx.local': renderFail2banJail(model, paths),
  };
}
