/**
 * Small, dependency-free random helpers. They use the Web Crypto API, which is available in Node 24
 * and every supported browser, so the same code generates secrets server-side and in tests.
 */
export type TokenAlphabet = 'base64url' | 'numeric' | 'hex' | 'uppercase';

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const NUMERIC = '0123456789';
const HEX = '0123456789abcdef';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const ALPHABETS: Record<TokenAlphabet, string> = {
  'base64url': BASE64URL,
  numeric: NUMERIC,
  hex: HEX,
  uppercase: UPPERCASE,
};

/** Uniform random integers in [0, max) without modulo bias. */
export function randomInts(count: number, max: number): number[] {
  if (!Number.isInteger(max) || max <= 0 || max > 256) {
    throw new RangeError('max must be an integer between 1 and 256');
  }
  const result: number[] = [];
  const buffer = new Uint8Array(Math.max(32, count * 2));
  const limit = Math.floor(256 / max) * max;
  while (result.length < count) {
    globalThis.crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte < limit) {
        result.push(byte % max);
        if (result.length === count) break;
      }
    }
  }
  return result;
}

/** Generate a token with exactly `length` characters from the requested alphabet. */
export function randomToken(length: number, alphabet: TokenAlphabet = 'base64url'): string {
  if (!Number.isInteger(length) || length < 1 || length > 256) {
    throw new RangeError('length must be an integer between 1 and 256');
  }
  const chars = ALPHABETS[alphabet];
  if (!chars) {
    throw new RangeError(`unknown token alphabet: ${alphabet}`);
  }
  return randomInts(length, chars.length)
    .map((index) => chars.charAt(index))
    .join('');
}
