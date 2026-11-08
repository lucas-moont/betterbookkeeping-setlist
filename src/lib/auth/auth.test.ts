import { describe, expect, test } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { expectOk } from "@/test/expect-ok";
import { memoryCookies } from "@/test/memory-cookies";
import * as auth from "./index";

const password = "correct horse";

function newAccount() {
  return { email: `user-${crypto.randomUUID()}@example.com`, name: "Lucas", password };
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

describe("signIn", () => {
  test("the right password sets the session cookie for that user", async () => {
    const db = await getServerSidePrismaClient();
    const account = newAccount();
    const { user } = expectOk(await auth.register(db, memoryCookies(), account));
    const cookies = memoryCookies();

    const signedIn = expectOk(await auth.signIn(db, cookies, { email: account.email, password }));

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

    expect(await auth.signIn(db, cookies, { email: account.email, password: "battery staple" })).toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
    expect(await auth.signIn(db, cookies, { email: newAccount().email, password })).toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
    expect(cookies.sets).toEqual([]);
  });
});

describe("currentUser", () => {
  test("is null with no cookie or with a cookie the server didn't issue", async () => {
    const db = await getServerSidePrismaClient();
    const { user } = expectOk(await auth.register(db, memoryCookies(), newAccount()));

    expect(await auth.currentUser(db, memoryCookies())).toBeNull();
    expect(await auth.currentUser(db, memoryCookies("not-a-session"))).toBeNull();
    expect(await auth.currentUser(db, memoryCookies(`${user.id}.forged-signature`))).toBeNull();
  });
});

describe("signOut", () => {
  test("deletes the session cookie", async () => {
    const db = await getServerSidePrismaClient();
    const cookies = memoryCookies();
    expectOk(await auth.register(db, cookies, newAccount()));

    expectOk(await auth.signOut(db, cookies));

    expect(cookies.deletes).toBe(1);
    expect(await auth.currentUser(db, cookies)).toBeNull();
  });
});
