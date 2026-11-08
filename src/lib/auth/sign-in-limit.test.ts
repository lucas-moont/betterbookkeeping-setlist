import { afterEach, describe, expect, test, vi } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { expectOk } from "@/test/expect-ok";
import { memoryCookies } from "@/test/memory-cookies";
import * as auth from "./index";
import { verifyPassword } from "./password";

// The real verifyPassword, wrapped so a test can see whether it ran.
vi.mock("./password", async (importOriginal) => {
  const original = await importOriginal<typeof import("./password")>();
  return { ...original, verifyPassword: vi.fn(original.verifyPassword) };
});

// The sign-in attempt limit: at most 5 failed sign-ins per email and IP in 15 minutes. Every test
// uses its own email, so tests sharing an IP never share a bucket. Keep every test that relies on
// stored failures in this file (see `start`).

const password = "correct horse";
const ip = "203.0.113.7";
const minute = 60 * 1000;
// Every sign-in deletes the failures older than 15 minutes by its own clock, of every email, and
// other test files sign in at the real time or at faked past dates on the same database. Running
// this file's clock far ahead keeps their cleanup away from its failures. It also means this
// file's sign-ins delete theirs, so a test elsewhere can't rely on stored failures.
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

async function signIn(email: string, { password: given = password, from = ip } = {}) {
  return auth.signIn(await getServerSidePrismaClient(), memoryCookies(), { email, password: given, ip: from });
}

/** One wrong password a minute, at minutes `first`, `first + 1`, ... */
async function failFiveTimes(email: string, { first = 0, from = ip } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    setMinute(first + attempt);
    expect(await signIn(email, { password: "battery staple", from })).toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
  }
}

describe("after 5 failed sign-ins in 15 minutes", () => {
  test("the next one is refused, even with the right password, and signs no one in", async () => {
    const { email } = await newAccount();
    await failFiveTimes(email);
    setMinute(5);
    const cookies = memoryCookies();

    const result = await auth.signIn(await getServerSidePrismaClient(), cookies, { email, password, ip });

    expect(result).toMatchObject({ ok: false, reason: "too-many-attempts" });
    expect(cookies.sets).toEqual([]);
  });

  test("says how many minutes until the oldest failure leaves the window, and then it works again", async () => {
    const { email, userId } = await newAccount();
    await failFiveTimes(email);

    setMinute(6);
    expect(await signIn(email)).toEqual({ ok: false, reason: "too-many-attempts", retryAfterMinutes: 9 });

    setMinute(15);
    expect(expectOk(await signIn(email)).user.id).toBe(userId);
  });

  test("rounds the wait up, and never says 0 minutes", async () => {
    const { email } = await newAccount();
    await failFiveTimes(email);

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
    await failFiveTimes(email);
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
    await failFiveTimes(email);
    await failFiveTimes(unknown);
    setMinute(5);
    vi.mocked(verifyPassword).mockClear();

    expect(await signIn(email)).toMatchObject({ reason: "too-many-attempts" });
    expect(await signIn(unknown)).toMatchObject({ reason: "too-many-attempts" });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  test("another IP is another bucket", async () => {
    const { email, userId } = await newAccount();
    await failFiveTimes(email);
    setMinute(5);

    expect(expectOk(await signIn(email, { from: "198.51.100.20" })).user.id).toBe(userId);
    expect(await signIn(email)).toMatchObject({ reason: "too-many-attempts" });
  });

  // Otherwise the answer would tell which emails have an account.
  test("an email with no account is limited the same way", async () => {
    const email = `nobody-${crypto.randomUUID()}@example.com`;
    await failFiveTimes(email);
    setMinute(6);

    expect(await signIn(email)).toEqual({ ok: false, reason: "too-many-attempts", retryAfterMinutes: 9 });
  });

  test("the email counts however it's typed", async () => {
    const { email } = await newAccount();
    for (let attempt = 0; attempt < 5; attempt++) {
      setMinute(attempt);
      await signIn(attempt % 2 ? ` ${email.toUpperCase()} ` : email, { password: "battery staple" });
    }
    setMinute(5);

    expect(await signIn(email)).toMatchObject({ reason: "too-many-attempts" });
  });
});

describe("a successful sign-in", () => {
  test("clears the failures of that email and IP", async () => {
    const { email, userId } = await newAccount();
    for (let attempt = 0; attempt < 4; attempt++) {
      setMinute(attempt);
      await signIn(email, { password: "battery staple" });
    }
    setMinute(4);
    expectOk(await signIn(email));
    for (let attempt = 5; attempt < 9; attempt++) {
      setMinute(attempt);
      await signIn(email, { password: "battery staple" });
    }

    setMinute(9);
    expect(expectOk(await signIn(email)).user.id).toBe(userId);
  });
});

describe("every sign-in", () => {
  // The window ignores them anyway, so the check goes back in time to a minute they still counted:
  // only deleted rows let the sign-in through there.
  test("deletes the failures older than 15 minutes, of every email", async () => {
    const { email, userId } = await newAccount();
    await failFiveTimes(email);

    setMinute(20);
    await signIn(`someone-else-${crypto.randomUUID()}@example.com`);

    setMinute(5);
    expect(expectOk(await signIn(email)).user.id).toBe(userId);
  });
});
