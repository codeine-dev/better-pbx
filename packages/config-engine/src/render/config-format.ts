export interface ConfigSection {
  name: string;
  lines: string[];
}

/**
 * Render an Asterisk-style INI document deterministically.
 *
 * Sections and lines keep the order the caller provides: ordering is meaningful in Asterisk
 * configuration, and deterministic output keeps Git snapshots and diffs meaningful.
 */
export function renderConfig(
  header: string[],
  sections: ConfigSection[],
  footer: string[] = [],
): string {
  const chunks: string[] = [];
  const comment = header.flatMap((line) => (line.length === 0 ? [''] : `; ${line}`.split('\n')));
  if (comment.length > 0) {
    chunks.push(comment.join('\n'));
  }

  for (const section of sections) {
    const lines = [`[${section.name}]`, ...section.lines];
    chunks.push(lines.join('\n'));
  }

  if (footer.length > 0) {
    chunks.push(footer.join('\n'));
  }

  return `${chunks.join('\n\n')}\n`;
}

/** Render `key = value`, skipping undefined values so optional settings never emit `key =`. */
export function assignment(key: string, value: string | number | boolean | undefined): string[] {
  if (value === undefined) return [];
  if (typeof value === 'boolean') return [`${key} = ${value ? 'yes' : 'no'}`];
  return [`${key} = ${value}`];
}

/** Append several assignments in a stable order. */
export function assignments(entries: Array<[string, string | number | boolean | undefined]>): string[] {
  return entries.flatMap(([key, value]) => assignment(key, value));
}

/** Asterisk's `same => n,Action` continuation, with an optional label. */
export function same(action: string, label?: string): string {
  return label === undefined ? ` same => n,${action}` : ` same => n(${label}),${action}`;
}

/** A literal extension entry (`exten => 100,1,...`) followed by `same` continuations. */
export function extension(numberOrPattern: string, actions: string[]): string[] {
  const [first, ...rest] = actions;
  if (first === undefined) return [];
  return [`exten => ${numberOrPattern},1,${first}`, ...rest.map((action) => same(action))];
}

/** Strip characters that would break a CSV-like Asterisk value (names, caller IDs). */
export function sanitizeValue(value: string): string {
  return value.replace(/[,\r\n]/g, ' ').trim();
}
