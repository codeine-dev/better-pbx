import type { RegionSettings } from '@better-pbx/shared';

import { renderConfig, type ConfigSection } from './config-format.js';

interface IndicationTones {
  description: string;
  lines: string[];
}

/**
 * Tone definitions for the countries we ship. An unknown country falls back to US tones rather
 * than emitting an empty section, which would make Asterisk fail to load indications.conf.
 */
const TONES: Record<string, IndicationTones> = {
  us: {
    description: 'United States / North America',
    lines: [
      'ringcadence = 2000,4000',
      'dial = 350+440',
      'busy = 480+620/500,0/500',
      'ring = 440+480/2000,0/4000',
      'congestion = 480+620/250,0/250',
      'callwaiting = 440/300,0/10000',
      'dialrecall = !350+440/100,!0/100,!350+440/100,!0/100,!350+440/100,!0/100,350+440',
      'record = 1400/500,0/15000',
      'info = !950/330,!1400/330,!1800/330,0',
      'stutter = !350+440/100,!0/100,!350+440/100,!0/100,!350+440/100,!0/100,!350+440/100,!0/100,!350+440/100,!0/100,!350+440/100,!0/100,350+440',
    ],
  },
  ca: {
    description: 'Canada',
    lines: [
      'ringcadence = 2000,4000',
      'dial = 350+440',
      'busy = 480+620/500,0/500',
      'ring = 440+480/2000,0/4000',
      'congestion = 480+620/250,0/250',
      'callwaiting = 440/300,0/10000',
      'dialrecall = !350+440/100,!0/100,!350+440/100,!0/100,!350+440/100,!0/100,350+440',
      'record = 1400/500,0/15000',
      'info = !950/330,!1400/330,!1800/330,0',
      'stutter = !350+440/100,!0/100,!350+440/100,!0/100,!350+440/100,!0/100,!350+440/100,!0/100,!350+440/100,!0/100,!350+440/100,!0/100,350+440',
    ],
  },
  gb: {
    description: 'United Kingdom',
    lines: [
      'ringcadence = 400,200,400,2000',
      'dial = 350+440',
      'busy = 400/375,0/375',
      'ring = 400+450/400,0/200,400+450/400,0/2000',
      'congestion = 400/400,0/350,400/350',
      'callwaiting = 400/100,0/100,400/100,0/2000',
      'dialrecall = 400/100,0/100,400/100,0/2000',
      'record = 1400/500,0/15000',
      'info = 950/330,1400/330,1800/330',
      'stutter = !350+440/100,!0/100,!350+440/100,!0/100',
    ],
  },
  ie: {
    description: 'Ireland',
    lines: [
      'ringcadence = 400,200,400,2000',
      'dial = 350+440',
      'busy = 400/375,0/375',
      'ring = 400+450/400,0/200,400+450/400,0/2000',
      'congestion = 400/400,0/350,400/350',
      'callwaiting = 400/100,0/100,400/100,0/2000',
      'dialrecall = 400/100,0/100,400/100,0/2000',
      'record = 1400/500,0/15000',
      'info = 950/330,1400/330,1800/330',
      'stutter = !350+440/100,!0/100,!350+440/100,!0/100',
    ],
  },
  de: {
    description: 'Germany',
    lines: [
      'ringcadence = 1000,4000',
      'dial = 425',
      'busy = 425/480,0/480',
      'ring = 425/1000,0/4000',
      'congestion = 425/240,0/240',
      'callwaiting = 425/240,0/240',
      'dialrecall = 425/240,0/240',
      'record = 1400/500,0/15000',
      'info = 950/330,1400/330,1800/330',
      'stutter = !425/100,!0/100,!425/100,!0/100',
    ],
  },
  fr: {
    description: 'France',
    lines: [
      'ringcadence = 1500,3500',
      'dial = 440',
      'busy = 440/500,0/500',
      'ring = 440/1500,0/3500',
      'congestion = 440/250,0/250',
      'callwaiting = 440/300,0/2700',
      'dialrecall = !440/100,!0/100,!440/100,!0/100,!440/100,!0/100,440',
      'record = 1400/500,0/15000',
      'info = !950/330,!1400/330,!1800/330,0',
      'stutter = !440/100,!0/100,!440/100,!0/100,!440/100,!0/100,!440/100,!0/100',
    ],
  },
  au: {
    description: 'Australia',
    lines: [
      'ringcadence = 400,200,400,2000',
      'dial = 413+438',
      'busy = 425/375,0/375',
      'ring = 413+438/400,0/200,413+438/400,0/2000',
      'congestion = 425/375,0/375',
      'callwaiting = 425/375,0/2000',
      'dialrecall = 425/375,0/2000',
      'record = 1400/500,0/15000',
      'info = 425/330,0/330',
      'stutter = !413+438/100,!0/100,!413+438/100,!0/100',
    ],
  },
  nz: {
    description: 'New Zealand',
    lines: [
      'ringcadence = 400,200,400,2000',
      'dial = 400',
      'busy = 400/375,0/375',
      'ring = 400/400,0/200,400/400,0/2000',
      'congestion = 400/375,0/375',
      'callwaiting = 400/250,0/2000',
      'dialrecall = 400/250,0/2000',
      'record = 1400/500,0/15000',
      'info = 400/330,0/330',
      'stutter = !400/100,!0/100,!400/100,!0/100',
    ],
  },
};

export function indicationsCountry(country: string): string {
  return TONES[country.toLowerCase()] === undefined ? 'us' : country.toLowerCase();
}

export function renderIndicationsConf(region: RegionSettings): string {
  const country = indicationsCountry(region.country);
  const tones = TONES[country];
  if (!tones) throw new Error(`missing built-in indications for ${country}`);

  const sections: ConfigSection[] = [
    { name: 'general', lines: [`country = ${country}`] },
    { name: country, lines: [`description = ${tones.description}`, ...tones.lines] },
  ];

  const header = [
    'BetterPBX tone indications.',
    '',
    'The setup wizard selects a country. Countries without a bundled tone definition fall back to',
    'US tones so the appliance still boots with valid indications.',
  ];
  if (country !== region.country.toLowerCase()) {
    header.push('', `No bundled tones for ${region.country}; using US tones.`);
  }

  return renderConfig(header, sections);
}
