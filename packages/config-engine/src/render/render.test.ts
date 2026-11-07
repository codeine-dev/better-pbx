import { describe, expect, it } from 'vitest';

import { buildCompleteModel } from '@better-pbx/test-fixtures';

import { renderTree } from './index.js';

describe('renderers', () => {
  it('renders every expected file deterministically', () => {
    const model = buildCompleteModel();
    const first = renderTree(model);
    const second = renderTree(model);

    expect(first).toEqual(second);
    expect(Object.keys(first.files)).toEqual(
      expect.arrayContaining([
        'asterisk/asterisk.conf',
        'asterisk/pjsip.conf',
        'asterisk/extensions.conf',
        'asterisk/queues.conf',
        'asterisk/voicemail.conf',
        'asterisk/logger.conf',
        'asterisk/rtp.conf',
        'asterisk/indications.conf',
        'asterisk/features.conf',
        'asterisk/modules.conf',
        'asterisk/cdr.conf',
        'asterisk/musiconhold.conf',
        'fail2ban/jail.d/better-pbx.local',
        'fail2ban/filter.d/asterisk-security.conf',
        'fail2ban/action.d/pbx-ban.conf',
        'fail2ban/fail2ban.d/better-pbx.local',
      ]),
    );
    for (const content of Object.values(first.files)) {
      expect(content.endsWith('\n')).toBe(true);
    }
  });

  it('never emits shared or unauthenticated endpoints', () => {
    const { files } = renderTree(buildCompleteModel());
    const pjsip = files['asterisk/pjsip.conf'] ?? '';

    expect(pjsip).not.toMatch(/\[anonymous\]/);
    expect(pjsip).not.toContain('identify_by=anonymous');
    expect(pjsip).not.toContain('anonymous endpoint');
    expect(pjsip).toContain('[auth-ext-100]');
    expect(pjsip).toContain('auth = auth-ext-100');
    expect(pjsip).toContain('transport = transport-tls');
    expect(pjsip).toContain('acl = global-acl');
    expect(files['asterisk/acl.conf']).toContain('#include /data/runtime/pjsip-acl.conf');
  });

  it('renders voicemail only for enabled mailboxes and escapes commas in names', () => {
    const { files } = renderTree(buildCompleteModel());
    const voicemail = files['asterisk/voicemail.conf'] ?? '';

    expect(voicemail).toContain('100 => 4821,Alice,alice@example.com');
    expect(voicemail).not.toContain('101 =>');
    expect(voicemail).toContain('maxmsg = 50');
  });

  it('fails closed in every inbound context', () => {
    const { files } = renderTree(buildCompleteModel());
    const dialplan = files['asterisk/extensions.conf'] ?? '';

    expect(dialplan).toContain('[from-trunk-trunk-primary]');
    expect(dialplan).toContain('include => from-trunk');
    expect(dialplan).toContain('exten => i,1,Hangup()');
    expect(dialplan).not.toContain('exten => _.,1,Dial');
  });
});
