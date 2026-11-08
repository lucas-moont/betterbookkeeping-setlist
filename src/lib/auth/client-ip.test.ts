import { describe, expect, test } from "vitest";
import { clientIp, deployWarnings } from "./client-ip";

const connectionIp = "10.0.0.5";

describe("clientIp without a trusted proxy", () => {
  // Anyone can send the header, so honoring it would let one client pose as any number of IPs.
  test("ignores x-forwarded-for and takes the connection's address", () => {
    expect(clientIp({ connectionIp, forwardedFor: "203.0.113.9", trustProxy: false })).toBe(connectionIp);
    expect(clientIp({ connectionIp, forwardedFor: undefined, trustProxy: false })).toBe(connectionIp);
  });
});

describe("clientIp behind a trusted proxy", () => {
  test("takes the address the proxy saw, the last entry of x-forwarded-for", () => {
    expect(clientIp({ connectionIp, forwardedFor: "203.0.113.9", trustProxy: true })).toBe("203.0.113.9");
    expect(clientIp({ connectionIp, forwardedFor: " 203.0.113.9 ", trustProxy: true })).toBe("203.0.113.9");
    expect(clientIp({ connectionIp, forwardedFor: "2001:db8::1", trustProxy: true })).toBe("2001:db8::/64");
  });

  // The proxy appends the address it saw to whatever the client sent, so only the last entry is
  // the proxy's word; everything before it is the client's.
  test("ignores entries the client wrote before the proxy's", () => {
    expect(clientIp({ connectionIp, forwardedFor: "198.51.100.1, 198.51.100.2, 203.0.113.9", trustProxy: true })).toBe(
      "203.0.113.9",
    );
  });

  test("falls back to the connection's address when the header is missing or its last entry isn't an IP", () => {
    for (const forwardedFor of [undefined, "", " ", "203.0.113.9, not-an-ip", "203.0.113.9,"]) {
      expect(clientIp({ connectionIp, forwardedFor, trustProxy: true })).toBe(connectionIp);
    }
  });
});

describe("clientIp with no address at all", () => {
  // The attempt limit still holds, per email, for every request the server can't place.
  test("is 'unknown'", () => {
    expect(clientIp({ connectionIp: undefined, forwardedFor: undefined, trustProxy: false })).toBe("unknown");
    expect(clientIp({ connectionIp: undefined, forwardedFor: "not-an-ip", trustProxy: true })).toBe("unknown");
    expect(clientIp({ connectionIp: "", forwardedFor: "203.0.113.9", trustProxy: false })).toBe("unknown");
  });
});

describe("clientIp normalization", () => {
  const ipOf = (address: string) => clientIp({ connectionIp: address, forwardedFor: undefined, trustProxy: false });

  test("keeps an IPv4 address as it is", () => {
    expect(ipOf("203.0.113.9")).toBe("203.0.113.9");
  });

  // A dual-stack server sees IPv4 clients as ::ffff:a.b.c.d, and one client must be one bucket.
  test("turns an IPv4-mapped IPv6 address into the IPv4 address, in any spelling", () => {
    for (const mapped of [
      "::ffff:203.0.113.9",
      "::FFFF:203.0.113.9",
      "::ffff:cb00:7109",
      "0:0:0:0:0:ffff:203.0.113.9",
    ]) {
      expect(ipOf(mapped)).toBe("203.0.113.9");
    }
  });

  // A single machine usually gets a whole /64, so per-address buckets would let it rotate freely.
  test("counts an IPv6 address under its /64, written one way", () => {
    expect(ipOf("2001:db8:0:1:aaaa::1")).toBe("2001:db8:0:1::/64");
    expect(ipOf("2001:DB8:0000:0001:BBBB:0:0:2")).toBe("2001:db8:0:1::/64");
    expect(ipOf("2001:db8::1")).toBe("2001:db8::/64");
    expect(ipOf("fe80::1%eth0")).toBe("fe80::/64");
    expect(ipOf("2001:db8:0:2::1")).not.toBe(ipOf("2001:db8:0:1::1"));
  });

  test("normalizes the address taken from x-forwarded-for the same way", () => {
    expect(clientIp({ connectionIp, forwardedFor: "198.51.100.1, ::ffff:203.0.113.9", trustProxy: true })).toBe(
      "203.0.113.9",
    );
    expect(clientIp({ connectionIp, forwardedFor: "2001:db8:0:1::abcd", trustProxy: true })).toBe("2001:db8:0:1::/64");
  });
});

// Both cases turn the limit into one bucket per email for everyone, so anyone could lock a victim
// out with five wrong passwords. The server says so in its log instead of failing quietly.
describe("deployWarnings", () => {
  test("warns when requests carry x-forwarded-for but TRUST_PROXY is off", () => {
    expect(deployWarnings({ forwardedFor: "203.0.113.9", trustProxy: false, ip: connectionIp })).toEqual([
      expect.stringContaining("TRUST_PROXY"),
    ]);
  });

  test("warns when the request has no address", () => {
    expect(deployWarnings({ forwardedFor: undefined, trustProxy: false, ip: "unknown" })).toEqual([
      expect.stringContaining('"unknown"'),
    ]);
  });

  test("says nothing for a direct request, or behind a trusted proxy", () => {
    expect(deployWarnings({ forwardedFor: undefined, trustProxy: false, ip: connectionIp })).toEqual([]);
    expect(deployWarnings({ forwardedFor: "203.0.113.9", trustProxy: true, ip: "203.0.113.9" })).toEqual([]);
  });
});
