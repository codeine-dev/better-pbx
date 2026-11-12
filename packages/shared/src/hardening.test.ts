import { describe, expect, it } from 'vitest';

import { createExtension, createInboundRoute } from './defaults.js';
import { settingsSchema } from './settings.js';

describe('hardening defaults', () => {
  it('rejects weak voicemail PINs', () => {
    expect(() =>
      createExtension({ id: 'e1', number: '100', displayName: 'A', voicemail: { enabled: true, pin: '1111' } }),
    ).toThrow();
    expect(() =>
      createExtension({ id: 'e2', number: '101', displayName: 'B', voicemail: { enabled: true, pin: '1234' } }),
    ).toThrow();
    expect(() =>
      createExtension({ id: 'e3', number: '102', displayName: 'C', voicemail: { enabled: true, pin: '4821' } }),
    ).not.toThrow();
  });

  it('rejects unsafe callerIdFilter values', () => {
    expect(() =>
      createInboundRoute({
        id: 'r1',
        name: 'R1',
        did: '100',
        destination: { type: 'hangup' },
        callerIdFilter: 'x"\r\n',
      }),
    ).toThrow();
  });

  it('defaults SIP TLS to 1.3 and SRTP on', () => {
    const settings = settingsSchema.parse({});
    expect(settings.network.tlsMethod).toBe('tlsv1_3');
    expect(settings.network.srtpEnabled).toBe(true);
  });
});
