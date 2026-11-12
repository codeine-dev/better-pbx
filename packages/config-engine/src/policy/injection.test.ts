import { describe, expect, it } from 'vitest';

import { sanitizeValue } from '../render/config-format.js';
import { scanRenderedConfig } from './rendered.js';

describe('config injection hardening', () => {
  it('sanitizeValue strips newlines, quotes, and control characters', () => {
    const malicious = 'alice"\r\nexten => hacked,1,Hangup()\x00';
    const sanitized = sanitizeValue(malicious);
    expect(sanitized).not.toMatch(/[\r\n"]/);
    expect(sanitized).not.toContain('\u0000');
  });

  it('rendered scan rejects a dialplan catch-all introduced through config', () => {
    const files = {
      'asterisk/extensions.conf': '[internal]\nexten => _X.,1,NoOp(x)\n same => n,Dial(PJSIP/${EXTEN}@trunk)\n',
      'asterisk/pjsip.conf': '[global]\ntype = global\n',
      'asterisk/logger.conf': 'security => security\n',
      'asterisk/modules.conf': 'autoload = no\n',
      'fail2ban/jail.d/better-pbx.local': '[better-pbx]\nenabled = true\nfilter = asterisk-security\nlogpath = /data/log/security\n',
      'asterisk/acl.conf': '#include /data/runtime/pjsip-acl.conf\n',
    };
    const issues = scanRenderedConfig(files);
    expect(issues.some((issue) => issue.code === 'catch-all-route')).toBe(true);
  });
});
