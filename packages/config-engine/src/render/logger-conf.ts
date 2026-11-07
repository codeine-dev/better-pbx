import { renderConfig, type ConfigSection } from './config-format.js';

/**
 * Console goes to the container stdout; `security` is the structured file fail2ban polls. It must
 * stay enabled: disabling it would silently disable brute-force protection.
 */
export function renderLoggerConf(): string {
  const sections: ConfigSection[] = [
    {
      name: 'general',
      lines: [
        'dateformat = %F %T',
        'use_callids = yes',
        'queue_log = yes',
        'queue_log_to_file = yes',
        'queue_log_name = queue_log',
      ],
    },
    {
      name: 'logfiles',
      lines: ['console => notice,warning,error', 'messages => notice,warning,error', 'security => security', 'sip => verbose,debug'],    },
  ];

  return renderConfig(
    [
      'BetterPBX logging.',
      '',
      'No credentials or SIP secrets are logged at notice level. The security channel is consumed',
      'by fail2ban and is mandatory for the appliance security model.',
    ],
    sections,
  );
}
