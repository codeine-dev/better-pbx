import { renderConfig, type ConfigSection } from './config-format.js';

/** Call features are limited to transfers and disconnect; parking and recording are non-goals. */
export function renderFeaturesConf(): string {
  const sections: ConfigSection[] = [
    {
      name: 'general',
      lines: ['transferdigittimeout = 3', 'featuredigittimeout = 1000'],
    },
    {
      name: 'featuremap',
      lines: ['blindxfer = #1', 'atxfer = *2', 'disconnect = *0'],
    },
  ];

  return renderConfig(
    ['BetterPBX call features. Parking, recording, and other non-goals are not enabled.'],
    sections,
  );
}
