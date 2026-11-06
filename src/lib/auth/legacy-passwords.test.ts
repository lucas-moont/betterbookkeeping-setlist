import { describe, expect, test } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { createUser } from "@/test/factories";
import { hashLegacyPasswords } from "./legacy-passwords";
import { hashPassword, verifyPassword } from "./password";

async function createUserWithPassword(password: string) {
  return createUser(await getServerSidePrismaClient(), { password });
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
