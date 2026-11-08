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
    if (isIP(proxySaw)) return proxySaw;
  }
  return connectionIp || "unknown";
}
