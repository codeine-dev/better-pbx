import type {
  Destination,
  Extension,
  InboundRoute,
  Ivr,
  PbxModel,
  Prompt,
  RingGroup,
  Trunk,
} from '@better-pbx/shared';

import { extension as extensionEntry, renderConfig, same, sanitizeValue, type ConfigSection } from './config-format.js';
import {
  createLookup,
  destinationActions,
  extensionEndpoint,
  ivrContext,
  queueName,
  trunkContext,
  trunkEndpoint,
  type ModelLookup,
} from '../model-lookup.js';

const EXTENSION_RING_SECONDS = 30;

function destinationEntry(target: string, destination: Destination, lookup: ModelLookup): string[] {
  return extensionEntry(target, destinationActions(destination, lookup));
}

function ensureHangup(actions: string[]): string[] {
  return actions.at(-1)?.startsWith('Hangup(') ? actions : [...actions, 'Hangup()'];
}

function extensionEntryFor(extension: Extension): string[] {
  const lines = [
    `exten => ${extension.number},1,NoOp(${sanitizeValue(`Call extension ${extension.displayName} <${extension.number}>`)})`,
    same(`Dial(PJSIP/${extensionEndpoint(extension.id)},${EXTENSION_RING_SECONDS})`),
  ];

  if (!extension.voicemail.enabled) {
    lines.push(same('Hangup()'));
    return lines;
  }

  lines.push(
    same('GotoIf($["${DIALSTATUS}" = "BUSY"]?vm-busy)'),
    same('GotoIf($["${DIALSTATUS}" = "NOANSWER"]?vm-noanswer)'),
    same('GotoIf($["${DIALSTATUS}" = "CHANUNAVAIL"]?vm-noanswer)'),
    same('Hangup()'),
    same(`VoiceMail(${extension.number}@default,u)`, 'vm-noanswer'),
    same('Hangup()'),
    same(`VoiceMail(${extension.number}@default,b)`, 'vm-busy'),
    same('Hangup()'),
  );
  return lines;
}

function ringGroupEntry(group: RingGroup, lookup: ModelLookup): string[] {
  const noAnswer = ensureHangup(destinationActions(group.destinationIfNoAnswer, lookup));
  const [firstNoAnswer, ...restNoAnswer] = noAnswer;
  const lines = [
    `exten => ${group.number},1,NoOp(${sanitizeValue(`Ring group ${group.name} <${group.number}>`)})`,
    same(`Queue(${queueName(group.id)},${group.ringTime + 5})`),
    same('GotoIf($["${QUEUESTATUS}" = "TIMEOUT"]?noanswer)'),
    same('Hangup()'),
  ];
  if (firstNoAnswer !== undefined) {
    lines.push(same(firstNoAnswer, 'noanswer'), ...restNoAnswer.map((action) => same(action)));
  }
  return lines;
}

function ivrEntry(ivr: Ivr): string[] {
  return extensionEntry(ivr.number ?? '', [`Goto(${ivrContext(ivr.id)},s,1)`]);
}

function outboundEntry(
  routeName: string,
  trunk: Trunk,
  pattern: { match: string; strip: number; prepend: string },
  callerId: string | undefined,
): string[] {
  const label = sanitizeValue(`Outbound route ${routeName} via ${trunk.name}`);
  return [
    `exten => ${pattern.match},1,NoOp(${label})`,
    same(`Set(OUTNUM=${pattern.strip === 0 ? '${EXTEN}' : `\${EXTEN:${pattern.strip}}`})`),
    ...(pattern.prepend === '' ? [] : [same(`Set(OUTNUM=${pattern.prepend}\${OUTNUM})`)]),
    ...(callerId === undefined ? [] : [same(`Set(CALLERID(num)=${sanitizeValue(callerId)})`)]),
    same(`Dial(PJSIP/\${OUTNUM}@${trunkEndpoint(trunk.id)},60)`),
    same('Hangup()'),
  ];
}

function emergencyEntries(model: PbxModel, lookup: ModelLookup): string[] {
  const primaryRoute = model.outboundRoutes
    .filter((route) => route.enabled)
    .slice()
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, 'en'))[0];
  const trunk = primaryRoute === undefined ? undefined : lookup.trunksById.get(primaryRoute.trunkId);

  return model.settings.region.emergencyNumbers.flatMap((number) => {
    if (trunk === undefined || !trunk.enabled) {
      return [
        `exten => ${number},1,NoOp(${sanitizeValue(`Emergency call ${number}: no outbound trunk configured`)})`,
        same('Playback(ss-noservice)'),
        same('Hangup()'),
      ];
    }
    return [
      `exten => ${number},1,NoOp(${sanitizeValue(`Emergency call ${number} via ${trunk.name}`)})`,
      same(`Dial(PJSIP/\${EXTEN}@${trunkEndpoint(trunk.id)},120)`),
      same('Hangup()'),
    ];
  });
}

function inboundEntries(
  route: InboundRoute,
  destination: Destination,
  lookup: ModelLookup,
): string[] {
  const actions = destinationActions(destination, lookup);
  const [first, ...rest] = actions;
  if (first === undefined) return [];

  const lines = [`exten => ${route.did},1,NoOp(${sanitizeValue(`Inbound route ${route.name}`)})`];
  const filter = route.callerIdFilter;
  if (filter === undefined || filter === '') {
    lines.push(same(first), ...rest.map((action) => same(action)));
  } else {
    lines.push(
      same(`GotoIf($["\${CALLERID(num)}" : "${filter.replace(/"/g, '')}"]?allowed)`),
      same('Hangup()'),
      same(first, 'allowed'),
      ...rest.map((action) => same(action)),
    );
  }
  return lines;
}

function ivrSections(ivr: Ivr, prompt: Prompt | undefined, lookup: ModelLookup): ConfigSection[] {
  if (prompt === undefined) throw new Error(`IVR ${ivr.id} references unknown prompt ${ivr.greetingPromptId}`);

  const sLines = [
    same('Answer()'),
    same('Set(RETRIES=0)'),
    same(`Background(${prompt.file})`, 'retry'),
    same(`WaitExten(${ivr.timeoutSeconds})`),
    same('Set(RETRIES=$[${RETRIES}+1])'),
    same(`GotoIf($[${'${RETRIES}'} > ${ivr.maxRetries}]?${ivrContext(ivr.id)}-timeout,s,1)`),
    same(`Goto(${ivrContext(ivr.id)},s,retry,1)`),
  ];
  void lookup;

  const sections: ConfigSection[] = [
    {
      name: ivrContext(ivr.id),
      lines: [
        `exten => s,1,NoOp(${sanitizeValue(`IVR ${ivr.name}`)})`,
        ...sLines,
        ...ivr.options.flatMap((option) => destinationEntry(option.digit, option.destination, lookup)),
        ...(ivr.directDial ? ['exten => _X!,1,Goto(internal,${EXTEN},1)'] : []),
        'exten => i,1,Set(RETRIES=$[${RETRIES}+1])',
        same(`GotoIf($[${'${RETRIES}'} > ${ivr.maxRetries}]?${ivrContext(ivr.id)}-invalid,s,1)`),
        same(`Goto(${ivrContext(ivr.id)},s,retry,1)`),
        `exten => t,1,Goto(${ivrContext(ivr.id)}-timeout,s,1)`,
        'exten => h,1,Hangup()',
      ],
    },
    {
      name: `${ivrContext(ivr.id)}-timeout`,
      lines: ensureHangup(destinationActions(ivr.timeoutDestination, lookup)).map((action, index) =>
        index === 0 ? `exten => s,1,${action}` : same(action),
      ),
    },
  ];

  if (ivr.invalidDestination !== undefined) {
    sections.push({
      name: `${ivrContext(ivr.id)}-invalid`,
      lines: ensureHangup(destinationActions(ivr.invalidDestination, lookup)).map((action, index) =>
        index === 0 ? `exten => s,1,${action}` : same(action),
      ),
    });
  } else {
    sections.push({
      name: `${ivrContext(ivr.id)}-invalid`,
      lines: ['exten => s,1,Playback(ss-noservice)', same('Hangup()')],
    });
  }

  return sections;
}

function internalSection(model: PbxModel, lookup: ModelLookup): ConfigSection {
  const lines: string[] = [
    '; Emergency numbers are explicit and take precedence over every other internal pattern.',
    ...emergencyEntries(model, lookup),
    '',
    '; Feature codes.',
    'exten => *97,1,VoiceMailMain(${CALLERID(num)}@default)',
    same('Hangup()'),
    'exten => *98,1,VoiceMailMain()',
    same('Hangup()'),
    '',
    '; Extensions, ring groups, and IVRs use exact numbers.',
  ];

  for (const extension of model.extensions
    .filter((candidate) => candidate.enabled)
    .slice()
    .sort((a, b) => a.number.localeCompare(b.number, 'en'))) {
    lines.push(...extensionEntryFor(extension));
  }

  for (const group of model.ringGroups.slice().sort((a, b) => a.number.localeCompare(b.number, 'en'))) {
    lines.push(...ringGroupEntry(group, lookup));
  }

  for (const ivr of model.ivrs) {
    if (ivr.number !== undefined) lines.push(...ivrEntry(ivr));
  }

  lines.push('', '; Outbound routes, highest priority first.');

  const routes = model.outboundRoutes
    .filter((route) => route.enabled)
    .slice()
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, 'en'));

  for (const route of routes) {
    const trunk = lookup.trunksById.get(route.trunkId);
    if (trunk === undefined || !trunk.enabled) {
      throw new Error(`outbound route ${route.name} references an unknown or disabled trunk`);
    }
    for (const pattern of route.patterns) {
      lines.push(...outboundEntry(route.name, trunk, pattern, route.callerId));
    }
  }

  lines.push('', 'exten => i,1,NoOp(No matching internal destination)', same('Hangup()'));
  lines.push('exten => t,1,Hangup()');

  return { name: 'internal', lines };
}

function inboundSection(
  name: string,
  routes: InboundRoute[],
  lookup: ModelLookup,
  includeGeneric: boolean,
): ConfigSection {
  const lines: string[] = [];
  for (const route of routes) {
    lines.push(...inboundEntries(route, route.destination, lookup));
  }
  if (includeGeneric) {
    lines.push('include => from-trunk');
  }
  lines.push('exten => i,1,Hangup()', 'exten => t,1,Hangup()');
  return { name, lines };
}

/**
 * The dialplan. Every context fails closed: no context contains a catch-all outbound route, and
 * unmatched calls reach an explicit `i`/`t` handler rather than a permissive pattern.
 */
export function renderExtensionsConf(model: PbxModel): string {
  const lookup = createLookup(model);
  const sections: ConfigSection[] = [
    {
      name: 'general',
      lines: ['static = yes', 'writeprotect = yes', 'clearglobalvars = no'],
    },
    {
      name: 'globals',
      lines: [`PBX_NAME = ${sanitizeValue(model.meta.pbxName)}`],
    },
    internalSection(model, lookup),
  ];

  for (const trunk of model.trunks
    .filter((candidate) => candidate.enabled)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const routes = model.inboundRoutes.filter(
      (route) => route.enabled && route.trunkId === trunk.id,
    );
    sections.push(inboundSection(trunkContext(trunk.id), routes, lookup, true));
  }

  const genericRoutes = model.inboundRoutes.filter(
    (route) => route.enabled && route.trunkId === undefined,
  );
  sections.push(inboundSection('from-trunk', genericRoutes, lookup, false));

  for (const ivr of model.ivrs) {
    const prompt = lookup.promptsById.get(ivr.greetingPromptId);
    sections.push(...ivrSections(ivr, prompt, lookup));
  }

  sections.push(
    {
      name: 'default',
      lines: ['exten => s,1,Hangup()', 'exten => i,1,Hangup()', 'exten => t,1,Hangup()'],
    },
    {
      name: 'public',
      lines: ['exten => s,1,Hangup()', 'exten => i,1,Hangup()', 'exten => t,1,Hangup()'],
    },
  );

  return renderConfig(
    [
      'BetterPBX dialplan.',
      '',
      'The dialplan is generated only by the typed renderer. Destinations reference resource IDs,',
      'and every context fails closed rather than routing calls it does not understand.',
    ],
    sections,
  );
}
