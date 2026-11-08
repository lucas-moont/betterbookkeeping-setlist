import { describe, expect, test } from "vitest";
import { clientIp } from "./client-ip";

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
    expect(clientIp({ connectionIp, forwardedFor: "2001:db8::1", trustProxy: true })).toBe("2001:db8::1");
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
