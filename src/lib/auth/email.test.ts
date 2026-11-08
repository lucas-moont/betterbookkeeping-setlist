import { describe, expect, test } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { runMigrationFunction, whitespaceAndCaseInputs } from "@/test/migrations/migration-functions";
import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  test("ignores case, so 'Lucas@Example.com' and 'lucas@example.com' are one address", () => {
    expect(normalizeEmail("Lucas@Example.com")).toBe("lucas@example.com");
    expect(normalizeEmail("LUCAS@EXAMPLE.COM")).toBe("lucas@example.com");
  });

  test("drops the whitespace around the address", () => {
    expect(normalizeEmail(" lucas@example.com\t\n")).toBe("lucas@example.com");
  });

  // The migration rewrites the existing addresses in SQL. If the two drifted apart, an account
  // stored by the migration could never be found again by sign-in.
  test("gives the same address as the SQL in the migration", async () => {
    const emails = [
      "lucas@example.com",
      "Lucas@Example.COM",
      " lucas@example.com ",
      `${String.fromCharCode(0xa0)}İLKER@EXAMPLE.COM${String.fromCharCode(0x3000)}`,
      ...whitespaceAndCaseInputs,
    ];

    const normalized = await runMigrationFunction(
      await getServerSidePrismaClient(),
      "normalize_user_emails",
      "normalize_email",
      emails,
    );

    expect(normalized).toEqual(emails.map(normalizeEmail));
  });
});
