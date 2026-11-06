import { describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  test("hashes with argon2id", async () => {
    expect(await hashPassword("correct horse")).toMatch(/^\$argon2id\$/);
  });

  test("salts every hash, so the same password hashes differently", async () => {
    expect(await hashPassword("correct horse")).not.toBe(await hashPassword("correct horse"));
  });

  test("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse");

    expect(await verifyPassword(hash, "correct horse")).toBe(true);
    expect(await verifyPassword(hash, "battery staple")).toBe(false);
  });

  test("never accepts a stored value that is not a hash", async () => {
    expect(await verifyPassword("plaintext-password", "plaintext-password")).toBe(false);
    expect(await verifyPassword("$argon2id$not-a-real-hash", "anything")).toBe(false);
  });
});
