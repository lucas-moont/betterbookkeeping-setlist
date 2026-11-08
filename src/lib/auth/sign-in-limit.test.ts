import { PrismaPg } from "@prisma/adapter-pg";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { expectOk } from "@/test/expect-ok";
import { type MemoryCookies, memoryCookies } from "@/test/memory-cookies";
import { PrismaClient } from "../../../prisma/generated/client/client";
import { clientIp } from "./client-ip";
import * as auth from "./index";
import { verifyPassword } from "./password";

// The real verifyPassword, wrapped so a test can see whether it ran.
vi.mock("./password", async (importOriginal) => {
  const original = await importOriginal<typeof import("./password")>();
  return { ...original, verifyPassword: vi.fn(original.verifyPassword) };
});

// The sign-in attempt limit: at most 5 Failed Sign-ins per email and IP in 15 minutes. Every test
// uses its own email, so tests sharing an IP never share a bucket. Keep every test that relies on
// stored failures in this file (see `start`).

const password = "correct horse";
const ip = "203.0.113.7";
const minute = 60 * 1000;
// Every sign-in that stores a failure deletes the failures older than 15 minutes by its own clock,
// of every email, and other test files sign in at the real time or at faked past dates on the same
// database. Running this file's clock far ahead keeps their cleanup away from its failures. It
// also means this file's sign-ins delete theirs, so a test elsewhere can't rely on stored failures.
const start = new Date("2100-01-01T12:00:00Z").getTime();

afterEach(() => {
  vi.useRealTimers();
});

/** Freezes the clock `minutes` after `start` (only Date, so the database driver's timers keep running). */
function setMinute(minutes: number) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(start + minutes * minute));
}

async function newAccount() {
  const db = await getServerSidePrismaClient();
  const email = `user-${crypto.randomUUID()}@example.com`;
  const { user } = expectOk(await auth.register(db, memoryCookies(), { email, name: "Lucas", password }));
  return { email, userId: user.id };
}

async function signIn(
  email: string,
  {
    from = ip,
    password: given = password,
    cookies = memoryCookies(),
  }: { from?: string; password?: string; cookies?: MemoryCookies } = {},
) {
  return auth.signIn(await getServerSidePrismaClient(), cookies, { email, password: given, ip: from });
}

/** Per attempt, the same value, or one computed from the attempt's index. */
type PerAttempt = string | ((attempt: number) => string);

const valueAt = (value: PerAttempt, attempt: number) => (typeof value === "function" ? value(attempt) : value);

/** One wrong password a minute, at minutes `first`, `first + 1`, ..., each one a Failed Sign-in. */
async function fail(
  email: PerAttempt,
  { times = 5, first = 0, from = ip }: { times?: number; first?: number; from?: PerAttempt } = {},
) {
  for (let attempt = 0; attempt < times; attempt++) {
    setMinute(first + attempt);
    const result = await signIn(valueAt(email, attempt), { from: valueAt(from, attempt), password: "battery staple" });
    expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
  }
}

describe("after 5 failed sign-ins in 15 minutes", () => {
  test("the next one is refused, even with the right password, and signs no one in", async () => {
    const { email } = await newAccount();
    await fail(email);
    setMinute(5);
    const cookies = memoryCookies();

    const result = await signIn(email, { cookies });

    expect(result).toMatchObject({ ok: false, reason: "too-many-attempts" });
    expect(cookies.sets).toEqual([]);
  });

  test("says how many minutes until the oldest failure leaves the window, and then it works again", async () => {
    const { email, userId } = await newAccount();
    await fail(email);

    setMinute(6);
    expect(await signIn(email)).toEqual({ ok: false, reason: "too-many-attempts", retryAfterMinutes: 9 });

    setMinute(15);
    expect(expectOk(await signIn(email)).user.id).toBe(userId);
  });

  test("rounds the wait up, and never says 0 minutes", async () => {
    const { email } = await newAccount();
    await fail(email);

    setMinute(14.5);
    expect(await signIn(email)).toMatchObject({ retryAfterMinutes: 1 });
    setMinute(14.99);
    expect(await signIn(email)).toMatchObject({ retryAfterMinutes: 1 });
    setMinute(13.2);
    expect(await signIn(email)).toMatchObject({ retryAfterMinutes: 2 });
  });

  // Otherwise someone who keeps trying would stay locked out forever.
  test("a refused attempt is not stored, so it doesn't push the wait further out", async () => {
    const { email, userId } = await newAccount();
    await fail(email);
    for (const at of [6, 10, 14]) {
      setMinute(at);
      expect(await signIn(email, { password: "battery staple" })).toMatchObject({ reason: "too-many-attempts" });
    }

    setMinute(15);
    expect(expectOk(await signIn(email)).user.id).toBe(userId);
  });

  // Refused before any argon2 work, so a flood of attempts costs the server almost nothing.
  test("is refused without verifying the password, for an account or an unknown email", async () => {
    const { email } = await newAccount();
    const unknown = `nobody-${crypto.randomUUID()}@example.com`;
    await fail(email);
    await fail(unknown);
    setMinute(5);
    vi.mocked(verifyPassword).mockClear();

    expect(await signIn(email)).toMatchObject({ reason: "too-many-attempts" });
    expect(await signIn(unknown)).toMatchObject({ reason: "too-many-attempts" });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  test("another IP is another bucket", async () => {
    const { email, userId } = await newAccount();
    await fail(email);
    setMinute(5);

    expect(expectOk(await signIn(email, { from: "198.51.100.20" })).user.id).toBe(userId);
    expect(await signIn(email)).toMatchObject({ reason: "too-many-attempts" });
  });

  // Otherwise the answer would tell which emails have an account.
  test("an email with no account is limited the same way", async () => {
    const email = `nobody-${crypto.randomUUID()}@example.com`;
    await fail(email);
    setMinute(6);

    expect(await signIn(email)).toEqual({ ok: false, reason: "too-many-attempts", retryAfterMinutes: 9 });
  });

  test("the email counts however it's typed", async () => {
    const { email } = await newAccount();
    await fail((attempt) => (attempt % 2 ? ` ${email.toUpperCase()} ` : email));
    setMinute(5);

    expect(await signIn(email)).toMatchObject({ reason: "too-many-attempts" });
  });
});

// The rest of how the IP is read is in client-ip.test.ts; this is the one check end to end.
describe("the IP of the bucket", () => {
  test("without TRUST_PROXY, a new x-forwarded-for on every attempt is still the same bucket", async () => {
    const { email } = await newAccount();
    const fromForged = (forwardedFor: string) => clientIp({ connectionIp: ip, forwardedFor, trustProxy: false });
    await fail(email, { from: (attempt) => fromForged(`198.51.100.${attempt + 1}`) });
    setMinute(5);

    expect(await signIn(email, { from: fromForged("192.0.2.77") })).toMatchObject({ reason: "too-many-attempts" });
  });
});

describe("a successful sign-in", () => {
  test("clears the failures of that email and IP", async () => {
    const { email, userId } = await newAccount();
    await fail(email, { times: 4 });
    setMinute(4);
    expectOk(await signIn(email));
    await fail(email, { times: 4, first: 5 });

    setMinute(9);
    expect(expectOk(await signIn(email)).user.id).toBe(userId);
  });
});

describe("a sign-in that stores a failure", () => {
  // The window ignores them anyway, so the check goes back in time to a minute they still counted:
  // only deleted rows let the sign-in through there.
  test("deletes the failures older than 15 minutes, of every email", async () => {
    const { email, userId } = await newAccount();
    await fail(email);

    setMinute(20);
    await signIn(`someone-else-${crypto.randomUUID()}@example.com`);

    setMinute(5);
    expect(expectOk(await signIn(email)).user.id).toBe(userId);
  });
});

describe("parallel sign-ins", () => {
  // Each call gets its own client: one client sends its queries one at a time, which would hide the
  // race (ADR 0006).
  test("a burst of wrong passwords gets at most 5 password checks", async () => {
    const { email } = await newAccount();
    setMinute(0);
    const clients = Array.from(
      { length: 20 },
      () => new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) }),
    );
    vi.mocked(verifyPassword).mockClear();
    try {
      const results = await Promise.all(
        clients.map((db) => auth.signIn(db, memoryCookies(), { email, password: "battery staple", ip })),
      );

      const reasons = results.map((result) => (result.ok ? "ok" : result.reason));
      expect(reasons.filter((reason) => reason === "invalid-credentials").length).toBeLessThanOrEqual(5);
      expect(reasons.filter((reason) => reason !== "invalid-credentials" && reason !== "too-many-attempts")).toEqual(
        [],
      );
      expect(vi.mocked(verifyPassword).mock.calls.length).toBeLessThanOrEqual(5);

      // Only the checked ones stay stored: the bucket takes exactly the failures still missing.
      const invalid = reasons.filter((reason) => reason === "invalid-credentials").length;
      await fail(email, { times: 5 - invalid, first: 1 });
      setMinute(7);
      expect(await signIn(email)).toMatchObject({ reason: "too-many-attempts" });
    } finally {
      await Promise.all(clients.map((db) => db.$disconnect()));
    }
  }, 30_000);
});
