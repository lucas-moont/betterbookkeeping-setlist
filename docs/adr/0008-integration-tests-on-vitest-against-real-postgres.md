# Integration tests run on Vitest against a real Postgres

Domain modules (starting with the Current Workout module) are tested through their interface against a real Postgres 16. The tests use a `setlist_test` database on the existing Docker Compose instance, and Vitest runs them on Node with its default `forks` pool. Each test creates its own user, so tests share one database, run in parallel, and need no cleanup. A Vitest `globalSetup` runs `prisma migrate deploy` once, with `DATABASE_URL` pointing at the test database. The evidence is in `docs/research/testing-prisma-postgres.md`.

## Considered Options

- **`bun test`.** It ships with Bun and needs no dependency, but it runs tests in the Bun runtime while production runs on Node. Parallel runs only arrived in Bun 1.3.13 and are experimental; the repo uses 1.3.10.
- **PGlite.** In-process Postgres, but its Prisma adapter is community-maintained and can't run `prisma migrate deploy`. It also allows a single connection, so the "two concurrent Start Workout calls" race can't happen.
- **Mocking Prisma.** Can't exercise the hand-written partial unique index (ADR 0006), the CHECK constraint (ADR 0003), `AT TIME ZONE` grouping (ADR 0004), transaction rollback, or races, and those are what these modules exist to get right.
- **Rolling back a transaction per test.** Prisma 7.2 doesn't support `$transaction` on a transaction client (savepoints arrived in 7.5), a caught P2002 leaves Postgres's transaction aborted, and a race between two connections can't happen inside one test transaction.

## Consequences

The test database grows with every run. `bun run db:reset` against it clears it when needed. In CI, one job starts a Postgres 16 service container, runs `migrate deploy`, the integration tests, the build, and then the Playwright suite against the built server.

Domain modules wrap their functions in `createServerOnlyFn`, which is an identity function at runtime (`@tanstack/start-fn-stubs`), so the tests need none of the TanStack Start or Nitro Vite plugins.
