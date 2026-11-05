import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./test-database-url";

/**
 * Runs once before any test worker starts: applies the migrations to the test database.
 * `prisma migrate deploy` creates the database when it doesn't exist yet.
 */
export default function setup() {
  const databaseName = new URL(testDatabaseUrl).pathname.slice(1);
  // Tests create rows and never clean up, so never point them at a real database.
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against "${databaseName}": the database name must end in _test.`,
    );
  }

  execSync("bunx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });
}
