import { describe, expect, test, vi } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { memoryCookies } from "@/test/memory-cookies";
import * as auth from "./index";
import { verifyPassword } from "./password";

// The real verifyPassword, wrapped so the test sees every call. Only this file mocks it.
vi.mock("./password", async (importOriginal) => {
  const original = await importOriginal<typeof import("./password")>();
  return { ...original, verifyPassword: vi.fn(original.verifyPassword) };
});

describe("signIn with an email that has no account", () => {
  // Without it, an unknown email would answer in a few milliseconds and a wrong password only after
  // the ~50 ms of argon2, and the time alone would tell which emails have an account.
  test("still verifies the password against an argon2id hash, then returns invalid-credentials", async () => {
    const db = await getServerSidePrismaClient();
    vi.mocked(verifyPassword).mockClear();

    const result = await auth.signIn(db, memoryCookies(), {
      email: `nobody-${crypto.randomUUID()}@example.com`,
      password: "correct horse",
    });

    expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(vi.mocked(verifyPassword).mock.calls[0]).toEqual([expect.stringMatching(/^\$argon2id\$/), "correct horse"]);
  });
});
