import { renderConfig, type ConfigSection } from './config-format.js';

export function renderCdrConf(): string {
  const sections: ConfigSection[] = [
    {
      name: 'general',
      lines: ['enable = yes', 'unanswered = no', 'congestion = no'],
    },
    {
      name: 'csv',
      lines: ['usegmtime = yes', 'loguniqueid = yes', 'accountlogs = no'],
    },
  ];

  return renderConfig(
    ['BetterPBX call detail records. cdr_csv writes under the configured log directory.'],
    sections,
  );
}
