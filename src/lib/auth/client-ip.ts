import { isIP } from "node:net";

// Which IP a sign-in attempt counts under (the attempt limit is per email and IP). Pure, so the
// tests can check it without a request.

/**
 * The client's IP for the attempt limit. Without a trusted proxy, the connection's own address:
 * x-forwarded-for is just a header anyone can send, and honoring it would let one client pose as
 * a new IP on every attempt.
 *
 * With `trustProxy` (TRUST_PROXY=true, for a deploy behind exactly one reverse proxy that appends
 * to x-forwarded-for), the last entry of the header: the address the proxy saw. The entries before
 * it are whatever the client sent, so they are never read. When that entry is missing or isn't an
 * IP, the connection's address, which is then the proxy's.
 *
 * With no address at all, "unknown". The bucket is still per email, so those requests share the
 * limit of each email instead of escaping it.
 *
 * The address comes back as the limit counts it (see ipBucket): IPv4 as it is, an IPv4-mapped
 * IPv6 address as its IPv4 address, and any other IPv6 address as its /64.
 */
export function clientIp({
  connectionIp,
  forwardedFor,
  trustProxy,
}: {
  connectionIp: string | undefined;
  forwardedFor: string | undefined;
  trustProxy: boolean;
}): string {
  if (trustProxy && forwardedFor !== undefined) {
    const proxySaw = forwardedFor.split(",").at(-1)?.trim() ?? "";
    if (isIP(proxySaw)) return ipBucket(proxySaw);
  }
  return connectionIp ? ipBucket(connectionIp) : "unknown";
}

/**
 * The bucket one address counts under. IPv6 goes through the URL parser, which already writes it
 * one canonical way (lower case, the longest zero run as "::", hex only), so no dependency is
 * needed. A dual-stack server sees IPv4 clients as ::ffff:a.b.c.d, and that is the IPv4 client. Any
 * other IPv6 address counts as its /64: one machine usually gets a whole /64, and per-address
 * buckets would let it rotate through them.
 */
function ipBucket(address: string): string {
  // The zone (fe80::1%eth0) only says which interface on this server, not who the client is.
  const unzoned = address.split("%")[0]!;
  if (isIP(unzoned) !== 6) return address;

  const groups = ipv6Groups(unzoned);
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6]! >> 8, groups[6]! & 0xff, groups[7]! >> 8, groups[7]! & 0xff].join(".");
  }
  return `${canonicalIpv6([...groups.slice(0, 4), 0, 0, 0, 0])}/64`;
}

/** An IPv6 address in the URL parser's canonical form: lower case, compressed, without brackets. */
function canonicalIpv6(address: string | number[]): string {
  const text = typeof address === "string" ? address : address.map((group) => group.toString(16)).join(":");
  return new URL(`http://[${text}]`).hostname.slice(1, -1);
}

/** The eight 16-bit groups of a valid IPv6 address. */
function ipv6Groups(address: string): number[] {
  const [head = "", tail] = canonicalIpv6(address).split("::");
  const parse = (part: string) => (part ? part.split(":").map((group) => parseInt(group, 16)) : []);
  const left = parse(head);
  const right = tail === undefined ? [] : parse(tail);
  return [...left, ...Array<number>(8 - left.length - right.length).fill(0), ...right];
}

/**
 * What the server log should say about how this request's IP was read. Either case means every
 * sign-in counts under one IP per email (the proxy's, or "unknown"), so anyone could lock a victim
 * out with five wrong passwords. The adapter prints each one once per process.
 */
export function deployWarnings({
  forwardedFor,
  trustProxy,
  ip,
}: {
  forwardedFor: string | undefined;
  trustProxy: boolean;
  ip: string;
}): string[] {
  const warnings: string[] = [];
  if (forwardedFor !== undefined && !trustProxy) {
    warnings.push(
      'Requests carry X-Forwarded-For but TRUST_PROXY is not "true", so the sign-in attempt limit counts every client under the proxy\'s address. Set TRUST_PROXY=true if the app runs behind one reverse proxy that appends to X-Forwarded-For, and is reachable only through it.',
    );
  }
  if (ip === "unknown") {
    warnings.push(
      'A request came with no client address, so its sign-ins count under "unknown": the attempt limit is per email only for such requests.',
    );
  }
  return warnings;
}
