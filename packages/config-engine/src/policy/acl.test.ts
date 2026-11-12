import { describe, expect, it } from 'vitest';

import { renderPjsipAcl } from './acl.js';
import { buildCompleteModel } from '@better-pbx/test-fixtures';

describe('runtime ACL', () => {
  it('emits whitelist permits, bans, then default permit', () => {
    const model = buildCompleteModel();
    const acl = renderPjsipAcl(model, { bannedCidrs: ['198.51.100.9/32'] });
    const lines = acl.split('\n');
    const permitWhitelist = lines.findIndex((line) => line.includes('permit = 203.0.113.0/24'));
    const denyBan = lines.findIndex((line) => line.includes('deny = 198.51.100.9/32'));
    const defaultPermit = lines.findIndex((line) => line.includes('permit = 0.0.0.0/0.0.0.0'));
    expect(permitWhitelist).toBeGreaterThan(-1);
    expect(denyBan).toBeGreaterThan(permitWhitelist);
    expect(defaultPermit).toBeGreaterThan(denyBan);
  });
});
