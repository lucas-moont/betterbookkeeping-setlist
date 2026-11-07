import { hashPassword } from "@/lib/auth/password";
import type { DbClient } from "@/lib/db.server";
import * as movements from "@/lib/movements";
import type { NewMovement } from "@/lib/movements";
import { expectOk } from "./expect-ok";

// Tests share one database with other workers (ADR 0008), so every row they create gets a unique
// name and each test only looks at the rows it created.

/** The password every factory user can sign in with, unless the test passes its own. */
const defaultPassword = "factory-password";

// Since ADR 0005 every account stores an argon2id hash; plaintext only exists as legacy data, which
// legacy-passwords.test.ts creates on purpose. Hashing costs ~50 ms, so each worker does it once.
let defaultPasswordHash: Promise<string> | undefined;

/** Creates a brand-new user. A given password is stored as is, so pass a hash unless the test wants legacy plaintext. */
export async function createUser(db: DbClient, { password }: { password?: string } = {}) {
  return db.user.create({
    data: {
      email: `user-${crypto.randomUUID()}@example.com`,
      password: password ?? (await (defaultPasswordHash ??= hashPassword(defaultPassword))),
    },
    select: { id: true },
  });
}

/**
 * Creates a Movement in the user's library (ADR 0001), through the movements module so its nameKey
 * is right. The suffix lets a test create several without picking names.
 */
export async function createMovement(
  db: DbClient,
  userId: string,
  { name = "Bench Press", muscleGroup = null }: Partial<NewMovement> = {},
) {
  const unique = `${name} ${crypto.randomUUID().slice(0, 8)}`;
  return expectOk(await movements.create(db, userId, { name: unique, muscleGroup })).movement;
}
