import { renderConfig } from './config-format.js';
import type { RenderPaths } from './types.js';

/**
 * Files that exist only to keep a feature disabled or at a safe default. They are rendered rather
 * than baked into the image so the configuration snapshot is complete and reviewable.
 */
export function renderSafetyFiles(paths: RenderPaths): Record<string, string> {
  return {
    'asterisk/acl.conf': renderConfig(
      [
        'BetterPBX named ACLs.',
        '',
        'The global-acl section is generated from the model whitelist/blacklist plus active bans and',
        'lives under the runtime directory, outside Git, because bans change without a snapshot.',
        'PJSIP endpoints reference it with `acl = global-acl`.',
      ],
      [],
      [`#include ${paths.dataDir}/runtime/pjsip-acl.conf`],
    ),
    'asterisk/ari.conf': renderConfig(
      ['ARI is deliberately disabled. The admin API is the only configuration surface.'],
      [{ name: 'general', lines: ['enabled = no'] }],
    ),
    'asterisk/ccss.conf': renderConfig(
      [
        'Call completion supplementary services are built into the Asterisk core, so leaving them',
        'enabled avoids a spurious module-load error. No endpoint or dialplan uses them.',
      ],
      [{ name: 'general', lines: ['enabled = yes'] }],
    ),
    'asterisk/cel.conf': renderConfig(
      ['CEL is kept at its defaults and writes only to the standard logger.'],
      [
        {
          name: 'general',
          lines: [
            'apps = dial,park',
            'events = APP_START,CHAN_START,CHAN_END,ANSWER,HANGUP,BRIDGE_ENTER,BRIDGE_EXIT',
          ],
        },
        { name: 'manager', lines: [] },
        { name: 'radius', lines: [] },
      ],
    ),
    'asterisk/http.conf': renderConfig(
      [
        "Asterisk's internal HTTP server is deliberately disabled. ARI depends on it and is also",
        'disabled, so there is no ARI/HTTP attack surface.',
      ],
      [
        {
          name: 'general',
          lines: ['enabled = no', 'bindaddr = 127.0.0.1', 'bindport = 8088'],
        },
      ],
    ),
    'asterisk/manager.conf': renderConfig(
      ['AMI is deliberately disabled. The API and UI never use AMI.'],
      [
        {
          name: 'general',
          lines: ['enabled = no', 'bindaddr = 127.0.0.1', 'port = 5038'],
        },
      ],
    ),
    'asterisk/pjproject.conf': renderConfig(
      [
        'Pool caching is left on for call performance. SIP traces never reach the persistent log',
        'by default.',
      ],
      [
        { name: 'startup', lines: ['cache_pools = yes'] },
        {
          name: 'log_mappings',
          lines: [
            'asterisk_error = 0,1',
            'asterisk_warning = 2',
            'asterisk_notice = 3',
            'asterisk_verbose = 4',
            'asterisk_debug = 5',
            'asterisk_trace = 6',
          ],
        },
      ],
    ),
    'asterisk/queuerules.conf': renderConfig(
      ['Ring groups do not use penalty rules; this file exists so app_queue does not warn.'],
      [],
    ),
    'asterisk/stasis.conf': renderConfig(
      [
        'Stasis is part of the core and must load, but ARI and public Stasis applications are not',
        'built into this image.',
      ],
      [
        {
          name: 'taskpool',
          lines: ['initial_size = 5', 'idle_timeout_sec = 20', 'max_size = 50'],
        },
        { name: 'declined_message_types', lines: [] },
      ],
    ),
    'asterisk/udptl.conf': renderConfig(
      [
        'T.38 is not enabled on any endpoint, but the core module requires the file and a bounded',
        'port range.',
      ],
      [
        {
          name: 'general',
          lines: [
            'udptlstart = 4000',
            'udptlend = 4999',
            'udptlfecentries = 3',
            'udptlfecspan = 3',
            'use_even_ports = no',
          ],
        },
      ],
    ),
  };
}
