import { createHmac } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { expectOk } from "@/test/expect-ok";
import { memoryCookies } from "@/test/memory-cookies";
import * as auth from "./index";

const password = "correct horse";
// Every sign-in here uses its own email, so one IP for all of them never reaches the attempt limit.
const ip = "203.0.113.1";
const day = 24 * 60 * 60 * 1000;
const fifteenDaysInSeconds = 15 * 24 * 60 * 60;
const start = new Date("2026-11-01T12:00:00Z").getTime();

function newAccount() {
  return { email: `user-${crypto.randomUUID()}@example.com`, name: "Lucas", password };
}

afterEach(() => {
  vi.useRealTimers();
});

/** Freezes the clock at `days` after `start` (only Date, so the database driver's timers keep running). */
function setDay(days: number) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(start + days * day));
}

describe("register", () => {
  test("signs the new user in, and the session only ever shows id, email and name", async () => {
    const db = await getServerSidePrismaClient();
    const cookies = memoryCookies();
    const account = newAccount();

    const { user } = expectOk(await auth.register(db, cookies, account));

    expect(user).toEqual({ id: expect.any(String), email: account.email, name: "Lucas" });
    // toStrictEqual on the whole object: any other key, even one holding undefined, fails it.
    expect(await auth.currentUser(db, cookies)).toStrictEqual({ id: user.id, email: account.email, name: "Lucas" });
  });

  test("ends the session the browser already had", async () => {
    const db = await getServerSidePrismaClient();
    const cookies = memoryCookies();
    expectOk(await auth.register(db, cookies, newAccount()));
    const copy = memoryCookies(cookies.get());

    const { user } = expectOk(await auth.register(db, cookies, newAccount()));

    expect(await auth.currentUser(db, copy)).toBeNull();
    expect((await auth.currentUser(db, cookies))?.id).toBe(user.id);
  });

  test("an email that already has an account returns email-taken and signs no one in", async () => {
    const db = await getServerSidePrismaClient();
    const account = newAccount();
    expectOk(await auth.register(db, memoryCookies(), account));
    const cookies = memoryCookies();

    expect(await auth.register(db, cookies, { ...account, name: "Someone else" })).toEqual({
      ok: false,
      reason: "email-taken",
    });
    expect(cookies.sets).toEqual([]);
  });
});

describe("email addresses", () => {
  test("ignore case and surrounding whitespace: ' Lucas@...' and 'lucas@...' are one account", async () => {
    const db = await getServerSidePrismaClient();
    const local = `lucas-${crypto.randomUUID()}`;
    const { user } = expectOk(
      await auth.register(db, memoryCookies(), {
        email: `${local.toUpperCase()}@Example.com`,
        name: "Lucas",
        password,
      }),
    );

    expect(user.email).toBe(`${local}@example.com`);
    expect(
      await auth.register(db, memoryCookies(), { email: ` ${local}@example.com `, name: "Lucas", password }),
    ).toEqual({ ok: false, reason: "email-taken" });
    for (const email of [`${local}@example.com`, ` ${local.toUpperCase()}@EXAMPLE.COM\t`]) {
      expect(expectOk(await auth.signIn(db, memoryCookies(), { email, password, ip })).user.id).toBe(user.id);
    }
  });
});

describe("signIn", () => {
  test("the right password sets the session cookie for that user", async () => {
    const db = await getServerSidePrismaClient();
    const account = newAccount();
    const { user } = expectOk(await auth.register(db, memoryCookies(), account));
    const cookies = memoryCookies();

    const signedIn = expectOk(await auth.signIn(db, cookies, { email: account.email, password, ip }));

    expect(signedIn.user).toStrictEqual({ id: user.id, email: account.email, name: "Lucas" });
    expect(cookies.sets).toHaveLength(1);
    expect((await auth.currentUser(db, cookies))?.id).toBe(user.id);
  });

  // The same answer for both, so sign-in can't be used to find out which emails have an account.
  test("a wrong password and an unknown email both return invalid-credentials and set no cookie", async () => {
    const db = await getServerSidePrismaClient();
    const account = newAccount();
    expectOk(await auth.register(db, memoryCookies(), account));
    const cookies = memoryCookies();

    expect(await auth.signIn(db, cookies, { email: account.email, password: "battery staple", ip })).toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
    expect(await auth.signIn(db, cookies, { email: newAccount().email, password, ip })).toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
    expect(cookies.sets).toEqual([]);
  });

  test("each sign-in is its own session, so signing in on a second device keeps the first one", async () => {
    const db = await getServerSidePrismaClient();
    const account = newAccount();
    const { user } = expectOk(await auth.register(db, memoryCookies(), account));
    const laptop = memoryCookies();
    const phone = memoryCookies();

    expectOk(await auth.signIn(db, laptop, { email: account.email, password, ip }));
    expectOk(await auth.signIn(db, phone, { email: account.email, password, ip }));

    expect(laptop.get()).not.toBe(phone.get());
    expect((await auth.currentUser(db, laptop))?.id).toBe(user.id);
    expect((await auth.currentUser(db, phone))?.id).toBe(user.id);
  });

  // Signing in again from the same browser (another account, or the same one) must not leave the
  // old Session valid for whoever copied its cookie.
  test("ends the session the browser already had", async () => {
    const db = await getServerSidePrismaClient();
    const account = newAccount();
    const { user } = expectOk(await auth.register(db, memoryCookies(), account));
    const cookies = memoryCookies();
    expectOk(await auth.signIn(db, cookies, { email: account.email, password, ip }));
    const copy = memoryCookies(cookies.get());

    expectOk(await auth.signIn(db, cookies, { email: account.email, password, ip }));

    expect(await auth.currentUser(db, copy)).toBeNull();
    expect((await auth.currentUser(db, cookies))?.id).toBe(user.id);
  });

  // Reading the expired session would delete it too, so the check goes back in time to a day it
  // was still valid: only a deleted row comes back null there.
  test("deletes the user's expired sessions", async () => {
    const db = await getServerSidePrismaClient();
    const account = newAccount();
    setDay(0);
    const old = memoryCookies();
    expectOk(await auth.register(db, old, account));

    setDay(16);
    expectOk(await auth.signIn(db, memoryCookies(), { email: account.email, password, ip }));

    setDay(1);
    expect(await auth.currentUser(db, old)).toBeNull();
  });
});

describe("currentUser", () => {
  test("is null with no cookie or with a cookie the server didn't issue", async () => {
    const db = await getServerSidePrismaClient();
    expectOk(await auth.register(db, memoryCookies(), newAccount()));

    expect(await auth.currentUser(db, memoryCookies())).toBeNull();
    expect(await auth.currentUser(db, memoryCookies("not-a-session"))).toBeNull();
  });

  // ADR 0009: no compatibility path, everyone signs in once more.
  test("is null for a cookie in the old signed userId.signature format", async () => {
    const db = await getServerSidePrismaClient();
    const { user } = expectOk(await auth.register(db, memoryCookies(), newAccount()));
    const signature = createHmac("sha256", "dev-secret-change-in-production").update(user.id).digest("hex");

    expect(await auth.currentUser(db, memoryCookies(`${user.id}.${signature}`))).toBeNull();
  });

  test("the cookie holds a random token, not the user ID, and lasts 15 days", async () => {
    const db = await getServerSidePrismaClient();
    const cookies = memoryCookies();

    const { user } = expectOk(await auth.register(db, cookies, newAccount()));

    expect(cookies.sets).toEqual([
      { token: expect.stringMatching(/^[\w-]{43}$/), maxAgeSeconds: fifteenDaysInSeconds },
    ]);
    expect(cookies.sets[0]?.token).not.toContain(user.id);
  });

  test("on day 2 renews the session for 15 more days and writes the cookie again", async () => {
    const db = await getServerSidePrismaClient();
    setDay(0);
    const cookies = memoryCookies();
    const { user } = expectOk(await auth.register(db, cookies, newAccount()));
    const token = cookies.get();

    setDay(2);
    expect((await auth.currentUser(db, cookies))?.id).toBe(user.id);

    expect(cookies.sets).toEqual([
      { token, maxAgeSeconds: fifteenDaysInSeconds },
      { token, maxAgeSeconds: fifteenDaysInSeconds },
    ]);
    // Past the first 15 days, only a renewed session is still valid.
    setDay(16.5);
    expect((await auth.currentUser(db, cookies))?.id).toBe(user.id);
  });

  // Renewing at most once a day keeps a read from turning into a write on every request (ADR 0009).
  test("half a day in leaves the session and the cookie as they are", async () => {
    const db = await getServerSidePrismaClient();
    setDay(0);
    const cookies = memoryCookies();
    expectOk(await auth.register(db, cookies, newAccount()));

    setDay(0.5);
    expect(await auth.currentUser(db, cookies)).not.toBeNull();

    expect(cookies.sets).toHaveLength(1);
    setDay(15.01);
    expect(await auth.currentUser(db, cookies)).toBeNull();
  });

  test("is null once the session expired, and the expired session is deleted", async () => {
    const db = await getServerSidePrismaClient();
    setDay(0);
    const cookies = memoryCookies();
    expectOk(await auth.register(db, cookies, newAccount()));

    setDay(15.01);
    expect(await auth.currentUser(db, cookies)).toBeNull();

    // Back on a day the session was valid: only a deleted row comes back null.
    setDay(1);
    expect(await auth.currentUser(db, cookies)).toBeNull();
  });
});

describe("the 90-day cap", () => {
  const minute = 60 * 1000;

  // Sliding alone would keep a stolen cookie alive forever as long as someone used it.
  test("a session used every day still ends 90 days after sign-in, and is deleted", async () => {
    const db = await getServerSidePrismaClient();
    setDay(0);
    const cookies = memoryCookies();
    expectOk(await auth.register(db, cookies, newAccount()));
    for (let at = 1; at <= 89; at++) {
      setDay(at);
      expect(await auth.currentUser(db, cookies)).not.toBeNull();
    }

    setDay(90 + minute / day);
    expect(await auth.currentUser(db, cookies)).toBeNull();

    // Back on a day the session was valid: only a deleted row comes back null.
    setDay(89);
    expect(await auth.currentUser(db, cookies)).toBeNull();
  });

  test("a renewal on day 80 lasts the 10 days left, in the row and in the cookie", async () => {
    const db = await getServerSidePrismaClient();
    setDay(0);
    const cookies = memoryCookies();
    expectOk(await auth.register(db, cookies, newAccount()));
    for (const at of [14, 28, 42, 56, 70]) {
      setDay(at);
      expect(await auth.currentUser(db, cookies)).not.toBeNull();
    }

    setDay(80);
    expect(await auth.currentUser(db, cookies)).not.toBeNull();

    expect(cookies.sets.at(-1)).toEqual({ token: cookies.get(), maxAgeSeconds: 10 * 24 * 60 * 60 });
    setDay(89.99);
    expect(await auth.currentUser(db, cookies)).not.toBeNull();
    setDay(90);
    expect(await auth.currentUser(db, cookies)).toBeNull();
  });

  // Every read in the last two weeks would otherwise renew to the same day 90: a write per request.
  test("once the expiry has reached day 90, reading the session writes nothing more", async () => {
    const db = await getServerSidePrismaClient();
    setDay(0);
    const cookies = memoryCookies();
    expectOk(await auth.register(db, cookies, newAccount()));
    for (const at of [14, 28, 42, 56, 70, 80]) {
      setDay(at);
      await auth.currentUser(db, cookies);
    }
    const setsAfterDay80 = cookies.sets.length;

    for (const at of [81, 85, 89]) {
      setDay(at);
      expect(await auth.currentUser(db, cookies)).not.toBeNull();
    }

    expect(cookies.sets).toHaveLength(setsAfterDay80);
  });

  // Sessions renewed before the cap existed can have an expiresAt past day 90. The test makes one
  // by moving expiresAt directly, since the module itself never writes such a row.
  test("ends a session 90 days after sign-in even when its expiresAt is later", async () => {
    const db = await getServerSidePrismaClient();
    setDay(0);
    const cookies = memoryCookies();
    const { user } = expectOk(await auth.register(db, cookies, newAccount()));
    await db.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(start + 100 * day) } });

    setDay(90 + minute / day);
    expect(await auth.currentUser(db, cookies)).toBeNull();
  });
});

describe("signOut", () => {
  test("ends the session and deletes the cookie", async () => {
    const db = await getServerSidePrismaClient();
    const cookies = memoryCookies();
    expectOk(await auth.register(db, cookies, newAccount()));
    expect(await auth.currentUser(db, cookies)).not.toBeNull();

    expectOk(await auth.signOut(db, cookies));

    expect(cookies.deletes).toBe(1);
    expect(await auth.currentUser(db, cookies)).toBeNull();
  });

  test("a copy of the cookie stops working too", async () => {
    const db = await getServerSidePrismaClient();
    const cookies = memoryCookies();
    expectOk(await auth.register(db, cookies, newAccount()));
    const copy = memoryCookies(cookies.get());

    expectOk(await auth.signOut(db, cookies));

    expect(await auth.currentUser(db, copy)).toBeNull();
  });

  test("only ends the session it was called with", async () => {
    const db = await getServerSidePrismaClient();
    const account = newAccount();
    const laptop = memoryCookies();
    const { user } = expectOk(await auth.register(db, laptop, account));
    const phone = memoryCookies();
    expectOk(await auth.signIn(db, phone, { email: account.email, password, ip }));

    expectOk(await auth.signOut(db, laptop));

    expect((await auth.currentUser(db, phone))?.id).toBe(user.id);
  });

  test("with no cookie still succeeds", async () => {
    const db = await getServerSidePrismaClient();
    const cookies = memoryCookies();

    expectOk(await auth.signOut(db, cookies));

    expect(cookies.deletes).toBe(1);
  });
});
