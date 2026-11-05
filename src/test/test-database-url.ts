/**
 * The database integration tests run against (ADR 0008). Defaults to `setlist_test` on the Docker
 * Compose Postgres; CI points TEST_DATABASE_URL at its own service container.
 */
export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:55432/setlist_test";
