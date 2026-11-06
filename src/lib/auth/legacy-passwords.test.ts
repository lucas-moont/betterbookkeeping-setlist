import { describe, expect, test } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { hashLegacyPasswords } from "./legacy-passwords";
import { hashPassword, verifyPassword } from "./password";

// Tests share one database with other workers (ADR 0008), so each one only looks at its own user.
async function createUserWithPassword(password: string) {
  const db = await getServerSidePrismaClient();
  return db.user.create({
    data: { email: `legacy-${crypto.randomUUID()}@example.com`, password },
    select: { id: true },
  });
}

async function storedPassword(userId: string) {
  const db = await getServerSidePrismaClient();
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { password: true } });
  return user.password;
}

describe("hashLegacyPasswords", () => {
  test("turns a plaintext password into an argon2id hash of the same password", async () => {
    const db = await getServerSidePrismaClient();
    const user = await createUserWithPassword("old-plaintext");

    await hashLegacyPasswords(db);

    const stored = await storedPassword(user.id);
    expect(stored).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(stored, "old-plaintext")).toBe(true);
  });

  test("running it twice changes nothing the second time", async () => {
    const db = await getServerSidePrismaClient();
    const user = await createUserWithPassword("old-plaintext");

    await hashLegacyPasswords(db);
    const afterFirstRun = await storedPassword(user.id);
    await hashLegacyPasswords(db);

    expect(await storedPassword(user.id)).toBe(afterFirstRun);
  });

  test("leaves passwords that are already hashed untouched", async () => {
    const db = await getServerSidePrismaClient();
    const hash = await hashPassword("already-hashed");
    const user = await createUserWithPassword(hash);

    await hashLegacyPasswords(db);

    expect(await storedPassword(user.id)).toBe(hash);
  });
});
