import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { migrationSqlPath } from "@/test/migrations/migration-folders";
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
  // stored by the migration could never be found again by sign-in. The test runs the functions
  // from the migration file itself, so it checks what the migration runs.
  test("gives the same address as the SQL in the migration", async () => {
    const db = await getServerSidePrismaClient();
    const emails = [
      "lucas@example.com",
      "Lucas@Example.COM",
      "  lucas@example.com  ",
      "\tLucas@example.com\n",
      "\r\flucas@example.com\v",
      // No-break and other Unicode spaces, as pasted from a web page or a phone keyboard.
      `${String.fromCharCode(0xa0)}lucas@example.com${String.fromCharCode(0xa0)}`,
      `${String.fromCharCode(0x2003, 0x3000)}Lucas@example.com${String.fromCharCode(0xfeff, 0x202f)}`,
      // Not whitespace for JavaScript, so it stays, in SQL too.
      `${String.fromCharCode(0x85)}lucas@example.com${String.fromCharCode(0x180e)}`,
      // Letters whose lower case differs between libc and the Unicode rules JavaScript follows.
      "ÉLODIE@EXAMPLE.FR",
      "JOÃO.CONCEIÇÃO@EXAMPLE.COM.BR",
      "ΟΔΥΣΣΕΑΣ@EXAMPLE.GR",
      "İLKER@EXAMPLE.COM",
      "GROẞ@EXAMPLE.DE",
    ];

    // pg_temp functions live in one connection, so the test pins one with a transaction.
    const normalized = await db.$transaction(async (tx) => {
      for (const statement of migrationEmailFunctions()) await tx.$executeRawUnsafe(statement);
      const rows = [];
      for (const email of emails) {
        const [{ key }] = await tx.$queryRaw<{ key: string }[]>`SELECT pg_temp.normalize_email(${email}) AS key`;
        rows.push(key);
      }
      return rows;
    });

    expect(normalized).toEqual(emails.map(normalizeEmail));
  });
});

/** The CREATE FUNCTION statements of the normalize_user_emails migration. */
function migrationEmailFunctions() {
  const sql = readFileSync(migrationSqlPath("normalize_user_emails"), "utf8");
  const statements = sql.match(/CREATE FUNCTION pg_temp\.[\s\S]*?\$\$;/g) ?? [];
  if (statements.length !== 2) throw new Error(`Expected 2 pg_temp functions, found ${statements.length}`);
  return statements;
}
