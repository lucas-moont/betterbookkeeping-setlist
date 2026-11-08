import { beforeAll, describe, expect, test } from "vitest";
import type { PrismaClient } from "../../../prisma/generated/client/client";
import { fixedId as id, migrationTestDatabase } from "./migration-test-database";

// Proves that the migration storing every email address in its normalized form (trimmed, lower
// case) rewrites only the addresses that need it, and refuses to run, changing nothing, when two
// users would end up with the same address. Uses the shared migration-test harness, one throwaway
// database per case.

async function insertUsers(db: PrismaClient, emails: string[]) {
  for (const [index, email] of emails.entries()) {
    await db.$executeRaw`INSERT INTO "User" (id, email, password, "updatedAt") VALUES
      (${id(index + 1)}, ${email}, 'hash', now())`;
  }
}

async function emails(db: PrismaClient) {
  const rows = await db.$queryRaw<{ email: string }[]>`SELECT email FROM "User" ORDER BY id`;
  return rows.map((row) => row.email);
}

describe("when no two users share an address once normalized", () => {
  const migration = migrationTestDatabase("normalize_user_emails");

  beforeAll(async () => {
    await insertUsers(migration.db, [
      "Lucas@Example.com",
      " maria@example.com\t",
      `${String.fromCharCode(0xa0)}JOAO@EXAMPLE.COM`,
      "already@example.com",
    ]);
    migration.applyTarget();
  }, 60_000);

  test("stores every address trimmed and in lower case", async () => {
    expect(await emails(migration.db)).toEqual([
      "lucas@example.com",
      "maria@example.com",
      "joao@example.com",
      "already@example.com",
    ]);
  });
});

describe("when two users share an address once normalized", () => {
  const migration = migrationTestDatabase("normalize_user_emails");
  const before = [
    "Lucas@Example.com",
    "lucas@example.com ",
    "maria@example.com",
    "Maria@example.com",
    "Ok@Example.com",
  ];
  let failure: unknown;

  beforeAll(async () => {
    await insertUsers(migration.db, before);
    try {
      migration.applyTarget();
    } catch (error) {
      failure = error;
    }
  }, 60_000);

  // The message lands in the deploy log, so it names the accounts by id and never by address.
  test("refuses to run, naming every colliding account by id and how many there are", () => {
    expect(failure).toBeInstanceOf(Error);
    const output = String((failure as { stderr?: Buffer }).stderr ?? "") + String((failure as Error).message);
    expect(output).toContain(`4 accounts share an email address`);
    expect(output).toContain(`(${id(1)}, ${id(2)}), (${id(3)}, ${id(4)})`);
    expect(output).not.toContain(id(5));
    for (const email of before) expect(output.toLowerCase()).not.toContain(email.trim().toLowerCase());
  });

  test("hints at the query that shows the colliding accounts", () => {
    const output = String((failure as { stderr?: Buffer }).stderr ?? "");
    expect(output).toContain(
      `SELECT id, email FROM "User" WHERE id IN ('${id(1)}', '${id(2)}', '${id(3)}', '${id(4)}')`,
    );
  });

  test("changes no address, not even the ones without a collision", async () => {
    expect(await emails(migration.db)).toEqual(before);
  });
});
