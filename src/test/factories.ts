import { hashPassword } from "@/lib/auth/password";
import type { PrismaClient } from "../../prisma/generated/client/client";

// Tests share one database with other workers (ADR 0008), so every row they create gets a unique
// name and each test only looks at the rows it created.

/** The password every factory user can sign in with, unless the test passes its own. */
const defaultPassword = "factory-password";

// Since ADR 0005 every account stores an argon2id hash; plaintext only exists as legacy data, which
// legacy-passwords.test.ts creates on purpose. Hashing costs ~50 ms, so each worker does it once.
let defaultPasswordHash: Promise<string> | undefined;

/** Creates a brand-new user. A given password is stored as is, so pass a hash unless the test wants legacy plaintext. */
export async function createUser(db: PrismaClient, { password }: { password?: string } = {}) {
  return db.user.create({
    data: {
      email: `user-${crypto.randomUUID()}@example.com`,
      password: password ?? (await (defaultPasswordHash ??= hashPassword(defaultPassword))),
    },
    select: { id: true },
  });
}

/** Creates a Movement with a unique name. Every user sees every movement until ADR 0001 lands. */
export function createMovement(db: PrismaClient, name = "Bench Press") {
  return db.movement.create({
    data: { name: `${name} ${crypto.randomUUID().slice(0, 8)}` },
    select: { id: true, name: true },
  });
}
