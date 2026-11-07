import { isIpv4, isIpv6 } from '@better-pbx/shared';

interface Ipv4Network {
  address: number;
  prefix: number;
}

function ipv4ToInt(value: string): number {
  return value
    .split('.')
    .reduce((result, octet) => (result << 8) | Number.parseInt(octet, 10), 0) >>> 0;
}

function parseIpv4Cidr(value: string): Ipv4Network | undefined {
  const [addressPart, prefixPart] = value.split('/');
  if (addressPart === undefined || !isIpv4(addressPart)) return undefined;
  const prefix = prefixPart === undefined ? 32 : Number.parseInt(prefixPart, 10);
  if (prefix < 0 || prefix > 32 || !Number.isInteger(prefix)) return undefined;
  return { address: ipv4ToInt(addressPart), prefix };
}

/**
 * True when two CIDRs describe any common address. IPv4 ranges are compared by network bits;
 * IPv6 ranges are compared by exact string only (Asterisk ACLs are most commonly IPv4 here).
 */
export function cidrOverlaps(a: string, b: string): boolean {
  if (a === b) return true;
  const ipv4A = parseIpv4Cidr(a);
  const ipv4B = parseIpv4Cidr(b);
  if (ipv4A !== undefined && ipv4B !== undefined) {
    const common = Math.min(ipv4A.prefix, ipv4B.prefix);
    const mask = common === 0 ? 0 : (0xffffffff << (32 - common)) >>> 0;
    return (ipv4A.address & mask) === (ipv4B.address & mask);
  }
  if (isIpv6(a.split('/')[0] ?? '') && isIpv6(b.split('/')[0] ?? '')) {
    return false;
  }
  return false;
}

export function normalizeCidr(value: string): string {
  return value.trim();
}
