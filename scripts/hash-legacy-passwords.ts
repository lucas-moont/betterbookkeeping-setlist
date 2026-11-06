// Converts legacy plaintext passwords to argon2id, once (ADR 0005). Safe to run on every start:
// already-hashed passwords are skipped. Run with `bun scripts/hash-legacy-passwords.ts`.
import { getServerSidePrismaClient } from "../src/lib/db.server";
import { hashLegacyPasswords } from "../src/lib/auth/legacy-passwords";

const db = await getServerSidePrismaClient();
try {
  const converted = await hashLegacyPasswords(db);
  console.log(`Hashed ${converted} legacy password(s).`);
} finally {
  await db.$disconnect();
}
