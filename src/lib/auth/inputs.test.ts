import { describe, expect, test } from "vitest";
import { createAccountInputSchema, signInInputSchema } from "./inputs";

const account = { email: "lucas@example.com", name: "Lucas", password: "correct horse" };

describe("signInInputSchema", () => {
  test("takes a password of up to 256 characters", () => {
    expect(signInInputSchema.safeParse({ ...account, password: "a".repeat(256) }).success).toBe(true);
    expect(signInInputSchema.safeParse({ ...account, password: "a".repeat(257) }).success).toBe(false);
  });

  test("takes the email without the whitespace a paste leaves around it, in the case it was typed", () => {
    expect(signInInputSchema.parse({ ...account, email: " Lucas@Example.com\t" }).email).toBe("Lucas@Example.com");
    expect(signInInputSchema.safeParse({ ...account, email: "not an email" }).success).toBe(false);
  });
});

describe("the email", () => {
  /** A valid address exactly `length` characters long. */
  const emailOfLength = (length: number) => `${"a".repeat(length - "@example.com".length)}@example.com`;

  // An emailKey longer than a btree index row allows would fail the insert after argon2 has run.
  test("takes up to 254 characters, the longest address SMTP allows", () => {
    for (const schema of [signInInputSchema, createAccountInputSchema]) {
      expect(schema.safeParse({ ...account, email: emailOfLength(254) }).success).toBe(true);
      expect(schema.safeParse({ ...account, email: emailOfLength(255) }).success).toBe(false);
    }
  });

  test("counts the length without the whitespace around it", () => {
    expect(signInInputSchema.safeParse({ ...account, email: ` ${emailOfLength(254)} ` }).success).toBe(true);
  });
});

describe("createAccountInputSchema", () => {
  test("takes a password of 6 to 256 characters", () => {
    for (const [length, valid] of [
      [5, false],
      [6, true],
      [256, true],
      [257, false],
    ] as const) {
      expect(createAccountInputSchema.safeParse({ ...account, password: "a".repeat(length) }).success).toBe(valid);
    }
  });

  test("takes a name of 1 to 100 characters", () => {
    for (const [length, valid] of [
      [0, false],
      [1, true],
      [100, true],
      [101, false],
    ] as const) {
      expect(createAccountInputSchema.safeParse({ ...account, name: "a".repeat(length) }).success).toBe(valid);
    }
  });

  test("takes the email without the whitespace around it", () => {
    expect(createAccountInputSchema.parse({ ...account, email: " lucas@example.com " }).email).toBe(
      "lucas@example.com",
    );
  });
});
