import { describe, expect, test } from "vitest";
import { sessionCookieOptions } from "./cookie-options";

describe("sessionCookieOptions", () => {
  test("leaves Secure off only in development and test, which run on plain http", () => {
    expect(sessionCookieOptions("development").secure).toBe(false);
    expect(sessionCookieOptions("test").secure).toBe(false);
  });

  // Fail-safe: a deploy that forgets to set ENVIRONMENT, or misspells it, still gets a Secure cookie.
  test("sets Secure in production, and for a missing or unknown environment", () => {
    for (const environment of ["production", undefined, "", "staging", "Development"]) {
      expect(sessionCookieOptions(environment).secure).toBe(true);
    }
  });

  test("is always httpOnly, SameSite=Lax and for the whole site", () => {
    for (const environment of ["development", "test", "production", undefined]) {
      expect(sessionCookieOptions(environment)).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    }
  });
});
