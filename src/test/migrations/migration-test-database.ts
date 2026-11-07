import { execSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../prisma/generated/client/client";
import { testDatabaseUrl } from "../test-database-url";
import { migrationFolders, migrationSqlPath, migrationsDir } from "./migration-folders";

// The harness every migration test shares: a throwaway database at the schema right before one
// migration, so a test can insert the cases the migration has to handle, apply only that migration,
// and check the result. It can't run in setlist_test, where every migration is already applied and
// other tests run in parallel (ADR 0008).

/** A fixed UUID, so a test's expected outcome doesn't depend on random ids. */
export const fixedId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/**
 * Registers the hooks that create the throwaway database, apply every migration before the one
 * named, and drop it at the end. Call it at the top of the test file, before its own beforeAll,
 * which then reads `db`, inserts its rows and calls `applyTarget()`.
 */
export function migrationTestDatabase(migrationName: string) {
  const targetSql = migrationSqlPath(migrationName);
  const targetFolder = path.basename(path.dirname(targetSql));
  const sqlBefore = migrationFolders()
    .filter((folder) => folder < targetFolder)
    .map((folder) => path.join(migrationsDir, folder, "migration.sql"));

  const databaseName = `setlist_migration_${crypto.randomUUID().replaceAll("-", "")}_test`;
  const databaseUrl = Object.assign(new URL(testDatabaseUrl), { pathname: `/${databaseName}` }).toString();
  // The admin client only creates and drops the throwaway database.
  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) });

  function applyMigration(sqlPath: string) {
    execSync(`bunx prisma db execute --file "${sqlPath}"`, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });
  }

  const harness = {
    /** The client of the throwaway database; set once the hooks have run. */
    db: undefined as unknown as PrismaClient,
    /** Applies only the migration under test. */
    applyTarget: () => applyMigration(targetSql),
  };

  beforeAll(async () => {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    for (const sqlPath of sqlBefore) applyMigration(sqlPath);
    harness.db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  }, 60_000);

  afterAll(async () => {
    await harness.db?.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.$disconnect();
  });

  return harness;
}
