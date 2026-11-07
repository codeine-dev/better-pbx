import { argon2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const MEMORY = 19456;
const PASSES = 2;
const PARALLELISM = 1;
const TAG_LENGTH = 32;
const SALT_LENGTH = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = argon2Sync('argon2id', {
    message: Buffer.from(password, 'utf8'),
    nonce: salt,
    parallelism: PARALLELISM,
    tagLength: TAG_LENGTH,
    memory: MEMORY,
    passes: PASSES,
  });
  return `argon2id$m=${MEMORY},t=${PASSES},p=${PARALLELISM}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const parts = encoded.split('$');
  if (parts.length !== 4 || parts[0] !== 'argon2id') return false;
  const part1 = parts[1] ?? '';
  const params: Record<string, string> = Object.fromEntries(
    part1.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k ?? '', v ?? ''];
    }),
  );
  const memory = Number(params.m);
  const passes = Number(params.t);
  const parallelism = Number(params.p);
  const salt = Buffer.from(parts[2] ?? '', 'base64');
  const expected = Buffer.from(parts[3] ?? '', 'base64');
  let computed: Buffer;
  try {
    computed = argon2Sync('argon2id', {
      message: Buffer.from(password, 'utf8'),
      nonce: salt,
      parallelism,
      tagLength: expected.length,
      memory,
      passes,
    });
  } catch {
    return false;
  }
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}