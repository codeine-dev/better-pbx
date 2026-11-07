/**
 * Asterisk dialplan pattern parsing.
 *
 * The model accepts patterns as strings because operators think in Asterisk syntax, but the API and
 * security policy need to reason about them without ever invoking Asterisk. This parser is the
 * single source of truth for what a pattern means, how broad it is, and whether it is a catch-all.
 */

export type PatternToken =
  | { kind: 'literal'; char: string }
  | { kind: 'class'; chars: string[]; source: string }
  | { kind: 'digit' }
  | { kind: 'nonzero' }
  | { kind: 'two-to-nine' }
  | { kind: 'one-or-more' }
  | { kind: 'zero-or-more' };

export interface ParsedDialplanPattern {
  raw: string;
  kind: 'literal' | 'pattern';
  tokens: PatternToken[];
  regex: RegExp;
  /** True when the pattern matches every single-digit or longer dialled string. */
  catchAll: boolean;
  /** Minimum number of characters the pattern can match (wildcards contribute their minimum). */
  minLength: number;
  /** Maximum length, or null when a trailing wildcard makes it unbounded. */
  maxLength: number | null;
}

export class DialplanPatternError extends Error {
  override readonly name = 'DialplanPatternError';

  constructor(
    readonly raw: string,
    message: string,
  ) {
    super(`invalid dialplan pattern "${raw}": ${message}`);
  }
}

const LITERAL_RE = /^[0-9*#+]+$/;
const CLASS_CHAR_RE = /^[0-9A-D*#+]$/;

function expandClass(source: string): string[] {
  // source is the inside of [...], e.g. "1-5" or "135" or "1-3*#".
  const chars: string[] = [];
  let index = 0;
  while (index < source.length) {
    const start = source.charAt(index);
    if (!CLASS_CHAR_RE.test(start)) {
      throw new Error(`unsupported character "${start}" in character class`);
    }
    if (source.charAt(index + 1) === '-') {
      const end = source.charAt(index + 2);
      if (end === '' || !CLASS_CHAR_RE.test(end)) {
        throw new Error('unterminated range in character class');
      }
      const startCode = start.charCodeAt(0);
      const endCode = end.charCodeAt(0);
      if (endCode < startCode) throw new Error('descending range in character class');
      for (let code = startCode; code <= endCode; code += 1) chars.push(String.fromCharCode(code));
      index += 3;
    } else {
      chars.push(start);
      index += 1;
    }
  }
  if (chars.length === 0) throw new Error('empty character class');
  return [...new Set(chars)];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePatternBody(raw: string, body: string): PatternToken[] {
  const tokens: PatternToken[] = [];
  let index = 0;
  while (index < body.length) {
    const char = body.charAt(index);
    switch (char) {
      case 'X':
        tokens.push({ kind: 'digit' });
        index += 1;
        break;
      case 'Z':
        tokens.push({ kind: 'nonzero' });
        index += 1;
        break;
      case 'N':
        tokens.push({ kind: 'two-to-nine' });
        index += 1;
        break;
      case '.':
        if (index !== body.length - 1) {
          throw new DialplanPatternError(raw, '`.` is only valid as the final token');
        }
        tokens.push({ kind: 'one-or-more' });
        index += 1;
        break;
      case '!':
        if (index !== body.length - 1) {
          throw new DialplanPatternError(raw, '`!` is only valid as the final token');
        }
        tokens.push({ kind: 'zero-or-more' });
        index += 1;
        break;
      case '[': {
        const end = body.indexOf(']', index + 1);
        if (end === -1) throw new DialplanPatternError(raw, 'unterminated character class');
        const source = body.slice(index + 1, end);
        try {
          tokens.push({ kind: 'class', chars: expandClass(source), source });
        } catch (error) {
          throw new DialplanPatternError(raw, (error as Error).message);
        }
        index = end + 1;
        break;
      }
      default:
        if (!LITERAL_RE.test(char)) {
          throw new DialplanPatternError(raw, `unsupported character "${char}"`);
        }
        tokens.push({ kind: 'literal', char });
        index += 1;
        break;
    }
  }
  if (tokens.length === 0) throw new DialplanPatternError(raw, 'empty pattern');
  return tokens;
}

function tokenRegex(token: PatternToken): string {
  switch (token.kind) {
    case 'literal':
      return escapeRegex(token.char);
    case 'class':
      return `[${token.chars.map(escapeRegex).join('')}]`;
    case 'digit':
      return '[0-9]';
    case 'nonzero':
      return '[1-9]';
    case 'two-to-nine':
      return '[2-9]';
    case 'one-or-more':
      return '.+';
    case 'zero-or-more':
      return '.*';
  }
}

function tokenCoversAllDigits(token: PatternToken): boolean {
  if (token.kind === 'digit') return true;
  if (token.kind !== 'class') return false;
  return '0123456789'.split('').every((digit) => token.chars.includes(digit));
}

function isCatchAllTokens(tokens: PatternToken[]): boolean {
  if (tokens.length === 1) {
    const only = tokens[0];
    return only?.kind === 'one-or-more' || only?.kind === 'zero-or-more';
  }
  const last = tokens.at(-1);
  if (last?.kind !== 'one-or-more' && last?.kind !== 'zero-or-more') return false;
  return tokens.length === 2 && tokens[0] !== undefined && tokenCoversAllDigits(tokens[0]);
}

function minLengthOf(tokens: PatternToken[]): number {
  return tokens.reduce((total, token) => {
    switch (token.kind) {
      case 'literal':
      case 'class':
      case 'digit':
      case 'nonzero':
      case 'two-to-nine':
        return total + 1;
      case 'one-or-more':
        return total + 1;
      case 'zero-or-more':
        return total;
    }
  }, 0);
}

function maxLengthOf(tokens: PatternToken[]): number | null {
  const wildcard = tokens.find(
    (token) => token.kind === 'one-or-more' || token.kind === 'zero-or-more',
  );
  return wildcard === undefined ? tokens.length : null;
}

export function parseDialplanPattern(raw: string): ParsedDialplanPattern {
  const trimmed = raw.trim();
  if (trimmed === '') throw new DialplanPatternError(raw, 'empty pattern');

  if (!trimmed.startsWith('_')) {
    if (!LITERAL_RE.test(trimmed)) {
      throw new DialplanPatternError(raw, 'literal extensions may contain only digits, *, #, and +');
    }
    return {
      raw,
      kind: 'literal',
      tokens: trimmed.split('').map((char) => ({ kind: 'literal', char })),
      regex: new RegExp(`^${escapeRegex(trimmed)}$`),
      catchAll: false,
      minLength: trimmed.length,
      maxLength: trimmed.length,
    };
  }

  const tokens = parsePatternBody(raw, trimmed.slice(1));
  return {
    raw,
    kind: 'pattern',
    tokens,
    regex: new RegExp(`^${tokens.map(tokenRegex).join('')}$`),
    catchAll: isCatchAllTokens(tokens),
    minLength: minLengthOf(tokens),
    maxLength: maxLengthOf(tokens),
  };
}

export function isCatchAllPattern(raw: string): boolean {
  return parseDialplanPattern(raw).catchAll;
}

/** True when a dialled string is matched by a literal or pattern. Invalid patterns never match. */
export function patternMatches(raw: string, value: string): boolean {
  try {
    return parseDialplanPattern(raw).regex.test(value);
  } catch {
    return false;
  }
}

function sampleChoices(token: PatternToken): string[] {
  switch (token.kind) {
    case 'literal':
      return [token.char];
    case 'class':
      return [...new Set([token.chars[0], token.chars[Math.floor(token.chars.length / 2)], token.chars.at(-1)])]
        .filter((value): value is string => value !== undefined);
    case 'digit':
      return ['0', '5', '9'];
    case 'nonzero':
      return ['1', '5', '9'];
    case 'two-to-nine':
      return ['2', '5', '9'];
    case 'one-or-more':
      return ['5', '55', '555'];
    case 'zero-or-more':
      return ['', '5', '55'];
  }
}

/** Generate representative strings a pattern can match. Used for overlap and premium detection. */
export function patternSamples(raw: string, limit = 64): string[] {
  const parsed = parseDialplanPattern(raw);
  const choices = parsed.tokens.map(sampleChoices);
  const totalCombinations = choices.reduce((product, list) => product * list.length, 1);
  const count = Math.min(limit, totalCombinations);
  const samples: string[] = [];

  // Mixed-radix enumeration distributes samples across every token instead of exhausting the
  // earliest branch. Without this, a catch-all could hide behind the first few generated samples.
  for (let index = 0; index < count; index += 1) {
    let remainder = index;
    let sample = '';
    for (const list of choices) {
      sample += list[remainder % list.length];
      remainder = Math.floor(remainder / list.length);
    }
    samples.push(sample);
  }

  return [...new Set(samples)].slice(0, limit);
}

/**
 * Conservative overlap check. Exact duplicates and literal/pattern matches are certain; two
 * patterns are compared using representative samples generated from each side.
 */
export function patternsMayOverlap(a: string, b: string): boolean {
  let parsedA: ParsedDialplanPattern;
  let parsedB: ParsedDialplanPattern;
  try {
    parsedA = parseDialplanPattern(a);
    parsedB = parseDialplanPattern(b);
  } catch {
    return false;
  }

  if (parsedA.kind === 'literal' && parsedB.kind === 'literal') return a === b;
  if (parsedA.kind === 'literal') return parsedB.regex.test(a);
  if (parsedB.kind === 'literal') return parsedA.regex.test(b);
  if (parsedA.regex.source === parsedB.regex.source) return true;

  return (
    patternSamples(a).some((sample) => parsedB.regex.test(sample)) ||
    patternSamples(b).some((sample) => parsedA.regex.test(sample))
  );
}
