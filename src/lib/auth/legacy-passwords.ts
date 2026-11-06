import { createServerOnlyFn } from "@tanstack/react-start";
import type { PrismaClient } from "../../../prisma/generated/client/client";
import { hashPassword, passwordHashPrefix } from "./password";

/**
 * One-time conversion of legacy plaintext passwords to argon2id (ADR 0005). Postgres has no
 * argon2, so this can't be a SQL migration. It is idempotent: values that are already argon2
 * hashes are skipped. Returns how many passwords it converted.
 */
export const hashLegacyPasswords = createServerOnlyFn(async (db: PrismaClient): Promise<number> => {
  const legacyUsers = await db.user.findMany({
    where: { NOT: { password: { startsWith: passwordHashPrefix } } },
    select: { id: true, password: true },
  });

  let converted = 0;
  for (const user of legacyUsers) {
    // Only overwrite the exact value that was read, so a concurrent change is never clobbered.
    const { count } = await db.user.updateMany({
      where: { id: user.id, password: user.password },
      data: { password: await hashPassword(user.password) },
    });
    converted += count;
  }
  return converted;
});
