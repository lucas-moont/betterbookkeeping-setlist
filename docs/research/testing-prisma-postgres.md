# Testing a Prisma 7 + PostgreSQL domain module (2025–2026)

Research note, written 2026-11-05. Scope: how to test the "Current Workout" module, which is a set of plain TS functions `(db, userId, input) -> discriminated union` running on Prisma 7.2.0 (`@prisma/adapter-pg`, resolved `7.2.0` in `bun.lock`) against Postgres 16. Bracketed numbers point to [Sources](#6-sources). Text marked **(analysis)** is my own reasoning, not a sourced claim.

## 1. TL;DR

- **Runner:** Vitest on Node, using the default `forks` pool [21]. Give it its own `vitest.config.ts` with only `vite-tsconfig-paths` (already a dependency), and leave out the TanStack Start and Nitro plugins. Start it through `bun run`: by default Bun runs the `vitest` bin under Node because of its shebang [30]. Production runs on Node 22, so the tests do too. `bun test` would run them in the Bun runtime [25].
- **Database:** real Postgres 16. By default, use a separate `setlist_test` database on the existing Compose instance (port 55432). Testcontainers (`@testcontainers/postgresql` 12.x [19][42]) is the hermetic alternative. PGlite and mocks can't exercise the concurrency requirement (section 2).
- **Isolation:** create a fresh user (unique data) per test. Every invariant is scoped to `userId`, so tests need no cleanup and parallel workers can share one database. **Do not use per-test transaction rollback.** On 7.2.0, `$transaction` called on a transaction client is not supported, because savepoint nesting only shipped in 7.5.0 [4][5]. And on any version, a race between two connections can't happen inside one test transaction (section 4).
- **Migrations:** a Vitest `globalSetup` [22] runs `prisma migrate deploy` once with `DATABASE_URL` pointing at the test database. `migrate deploy` creates the database if it is missing [12]. `prisma.config.ts` loads `.env` through dotenv, and dotenv never overrides a variable that is already set [41], so the override takes effect.
- **Mocks:** at most, keep them for pure branching logic. They cannot verify the partial unique index, the CHECK constraint, `AT TIME ZONE`, transaction semantics or races.

## 2. Database strategies compared

| | Real Postgres (Compose test DB / Testcontainers) | PGlite + `pglite-prisma-adapter` | Mocked Prisma (`vitest-mock-extended`, `prisma-mock`) |
|---|---|---|---|
| **Catches real Postgres behaviour** | All of it: the same engine and major version as production (pin `postgres:16`). Partial unique index, CHECK, `AT TIME ZONE`, `$transaction`, P2002 from concurrent connections. | Mostly. It is real Postgres compiled to WASM, but PGlite 0.5.15 reports **PostgreSQL 18.6**, not 16 (local smoke test, see note). It runs on a **single exclusive connection** [17], so the race test degrades to two sequential calls. | None. You assert what you assumed the database would do. |
| **Speed** | Container start takes a few seconds once per run, then each query is a network round trip (unmeasured here). Compose stays running, so the start cost disappears. | In-process, with no container. Per-test speed is unmeasured. | Fastest. |
| **Setup cost** | Low with Compose, which already exists: one extra DB plus `migrate deploy`. Testcontainers adds one dev dependency and a `globalSetup`. | Medium. A community adapter. `prisma migrate deploy` / `migrate dev` are **not supported** by the adapter per its README [15], so you would replay `prisma/migrations/*/migration.sql` through `pglite.exec()` (an unofficial pattern; **(analysis)**). | Low at first, but the mock setup grows with every query shape you add. |
| **CI cost** | Needs Docker on the runner (Testcontainers supports Docker, Podman, Colima and Rancher Desktop [20]). | None beyond Node. | None. |
| **Parallelism** | Full: a connection pool per worker, a shared DB with unique data, or a DB per worker. | One connection per PGlite instance [17]. `pglite-socket` multiplexes connections but "not all use cases are guaranteed to work" [18]. Prisma's own `prisma dev` (built on PGlite) "accepts one connection at a time" [13]. | Full. |
| **Maturity** | This is the approach in Prisma's official integration-testing guide (Docker Compose, `migrate deploy`) [1]. Testcontainers module is at 12.2.1 (Oct 2026) [42]. | PGlite itself is active (0.5.15, Nov 2026) [42]. The Prisma adapter is **community-maintained**, as Prisma's v7 docs say [3]. It has 55 stars [14] and was last published as 0.7.2 on 2026-01-17. It pins `@prisma/driver-adapter-utils` 7.2.0 and its dev tests target PGlite `^0.2.17` [16]. Its README still references `earlyAccess` / `driverAdapters` preview config [15]. | `vitest-mock-extended` 5.1.1 (Aug 2026, peer `vitest >=4`) [42]. `prisma-mock` 1.1.1 (Oct 2026, peer `@prisma/client` up to `^7`) [42]. Prisma's unit-testing guide uses `jest-mock-extended` [2]. |

**PGlite smoke test (local, not via Prisma):** I ran `@electric-sql/pglite` 0.5.15 under Node 24 in a scratch directory. A partial unique index rejected a second active row with `duplicate key value violates unique constraint`, a CHECK constraint rejected an invalid row, and `AT TIME ZONE 'America/New_York'` worked (`pg_timezone_names` returned 598 rows). So PGlite does model the constraints. It falls short on concurrency, migrations and version parity. I did **not** test it through `pglite-prisma-adapter` with Prisma 7.2.

**What mocks cannot catch in this module (analysis):**
- **Partial unique index.** Prisma can't express it in the schema, so a mock knows nothing about it. A test that "throws P2002" only proves you can throw P2002.
- **CHECK constraint.** The constraint is enforced only by Postgres.
- **`AT TIME ZONE` grouping in `$queryRaw`.** A mock returns rows you wrote by hand, so DST edges and day boundaries are never computed.
- **`$transaction` semantics.** Mocks don't model rollback, interactive-transaction timeouts (default `maxWait` 2000 ms and `timeout` 5000 ms [8]) or the aborted state Postgres enters after an error inside a transaction. "`ROLLBACK TO` is the only way to regain control of a transaction block that was put in aborted state" [35].
- **Races.** Two concurrent "start workout" calls only conflict at the index.
- **P2002 error shape under `adapter-pg`.** The metadata changed within 7.x: 7.10.0 made `adapter-pg` "preserve database constraint names" in P2002 [10]. Match on `code === 'P2002'` and confirm `meta` against a real database.

Supporting views: Kent C. Dodds, "Write tests. Not too many. Mostly integration." (2019): "When you mock something you're removing all confidence in the integration" [37]. Software Engineering at Google, ch. 13: "our first choice for tests is to use the real implementations", and it notes engineers are "avoiding mocking frameworks in favor of writing more realistic tests" [39]. Google Testing Blog, "Increase Test Fidelity By Avoiding Mocks" (2024-02-27) [40] makes the same point (I could only fetch its title and date; the summary of its body came from a search snippet). Fowler classifies an in-memory database as a *fake*, distinct from a mock [44], and distinguishes narrow from broad integration tests [38]. A test for this module against a real database is a narrow integration test.

## 3. Runner: `bun test` vs Vitest

| Concern | `bun test` | Vitest |
|---|---|---|
| Runtime parity with production (Node 22) | Tests "run in the Bun runtime" [25]. Bun counts any Node incompatibility as a Bun bug [28], so parity isn't guaranteed. `worker_threads` and `child_process` are only partially implemented [28]. | Runs on Node. Vitest 5 requires Node >= 22.12 and Vite >= 6.4 [23]. The repo has Vite 7.3.1. Vitest 5.1.0 was released 2026-11-02 [42]. |
| Native N-API deps (`@node-rs/argon2`) | Bun reimplements Node-API from scratch; "most existing Node-API extensions work" [27]. Whether `@node-rs/argon2` works specifically is **unverified**. | Plain Node loads native addons. The docs name Prisma as a native library that can segfault under `threads` and recommend `forks`, which is the default [21]. |
| `@/*` path alias | Supported natively through `compilerOptions.paths` [29]. | Use `vite-tsconfig-paths` (installed) in a test-only config. Vite 8 has an opt-in `resolve.tsconfigPaths` [43]; the repo is on Vite 7. |
| ESM / TS | Native. | Native, through Vite's transform. |
| Parallel workers | One process by default, with files sharing a global [25]. `--parallel[=N]` (worker processes) and `--isolate` arrived in **Bun 1.3.13 (2026-04-20)**, with per-file isolation described as "experimental" [26]. Whether the repo's "Bun 1.3" is ≥ 1.3.13 is unverified. | `forks` pool, one child process per worker. `VITEST_POOL_ID` identifies the worker slot, and **in Vitest 5 it starts at 1, not 0** [23][24]. `globalSetup` runs before workers start and passes values to them through `provide`/`inject` [22]. |
| Timezone control | Not researched. | `process.env.TZ` changes have no effect inside `threads` workers [21]. Another reason to stay on `forks` and set `TZ` in config. |

**Verdict:** Vitest. The main reason is runtime parity: the server runs on Node, and Bun is the package manager, not the runtime. Bun's parallel mode is also new and labelled experimental. Bun stays the script runner: `"test:int": "vitest run"`, run as `bun run test:int`, executes under Node because "Bun respects this shebang" unless `--bun` is passed [30].

## 4. Isolation strategies

### Finding: nested `$transaction` and rollback-per-test

- **Prisma ≤ 7.4 (this repo, 7.2.0):** no nested-transaction support. Savepoint-based nested rollback was "added" in **7.5.0 (2026-03-11)**, and it "enables using `$transaction` from an interactive transaction client" [4][5]. The PR was merged 2026-02-19 and covers Postgres, MySQL, SQLite and SQL Server; adapter commits include `pg` [6]. What 7.2 does instead (throw, or open an independent transaction) is **unverified**, because I did not run it.
- **Prisma ≥ 7.5:** the *callback* form `tx.$transaction(async (inner) => …)` runs on the outer connection through a savepoint. The *array* form `tx.$transaction([...])` still runs as a separate, independently committed transaction on another pooled connection. That is open issue #30755, reported on 7.10.1 [7].
- **Community helper:** `@chax-at/transactional-prisma-testing` 1.5.0 (peer Prisma `^4.7 … 7`) wraps each test in a transaction and emulates inner `$transaction` calls with savepoints. It also documents that parallel calls "will automatically be executed sequentially" [31][42]. A Prisma docs PR that would have documented per-test rollback was closed unmerged on 2026-09-16 [32].
- **Prisma 8 (RC, GA targeted Oct 2026)** replaces `$transaction` with `db.transaction`, and "calling `db.transaction(...)` again inside a callback does not nest" [9] (fetched from the current `/queries/transactions` page, which now documents v8). Prisma 7 receives fixes for 18 months after Prisma 8 GA [9].

**Why rollback-per-test is the wrong fit here regardless of version (analysis):**
1. **The race test needs two real connections.** Inside one test transaction, every call shares one connection and runs serially, as chax-at itself documents [31]. The second insert sees the first one's row (same transaction) and fails deterministically, with no overlap. You would be testing sequential behaviour and calling it a race test.
2. **A caught P2002 poisons the wrapper transaction.** After the unique violation, Postgres rejects further commands until a `ROLLBACK TO` [35][36]. If the module catches P2002 and then reads the existing workout on the same `db`, the test fails for reasons that don't happen in production. A savepoint avoids this only when the failing statement runs in its own nested `$transaction`.
3. Rollback-per-test also hides commit-time behaviour, and Prisma's 5 s interactive-transaction timeout [8] would apply to the whole test.

### Options

| Strategy | Works with Prisma 7 + parallel workers? | Notes |
|---|---|---|
| **Unique data per test: fresh `User` per test (recommended)** | Yes. | The partial index is `UNIQUE ("userId") WHERE "completedAt" IS NULL`, so the user is the natural isolation boundary. No cleanup and no lock contention. The race test runs `Promise.all([start(db,u), start(db,u)])` through a real `PrismaClient` and asserts exactly one row, plus one `ok` result and one "already active" result. The `pg` pool must allow ≥ 2 connections **(analysis)**. `Promise.all` doesn't *guarantee* the two calls overlap, but the outcome assertion holds either way. |
| Database per worker | Yes. | `CREATE DATABASE test_${VITEST_POOL_ID} TEMPLATE setlist_test_template` after migrating the template once. Postgres refuses to copy if any session is connected to the template, so `globalSetup` must disconnect first [34]. Use this fallback only if a test needs global state, such as counting all rows. |
| `TRUNCATE … RESTART IDENTITY CASCADE` between tests | Only serially or per worker. | `TRUNCATE` takes an `ACCESS EXCLUSIVE` lock and "is not MVCC-safe" [33]. Running it on a shared DB while other workers query wipes or blocks their data. Prisma's guide uses `deleteMany` in `afterAll` with `jest -i` (serial) [1]. |
| Per-test transaction rollback | Not for this module. | See the finding above. |
| Testcontainers `snapshot()` / `restoreSnapshot()` | Serially. | You must close client connections first, and you can't use the `postgres` database [19]. |

### Applying migrations to the test DB

- `prisma.config.ts` uses `env("DATABASE_URL")`, which throws if the variable is unset [11], and it loads `.env.local`/`.env` via dotenv. dotenv "will never modify any environment variables that have already been set" [41], so an explicit `DATABASE_URL=postgresql://…@localhost:55432/setlist_test` wins.
- `prisma migrate deploy` applies pending migrations, **creates the database if it doesn't exist**, and doesn't generate or reset anything [12]. That makes it the right command for `globalSetup`. The CLI reference lists no `--url` flag for it, so the env var is the override mechanism. `--config` is available [11][12].
- `prisma migrate reset --force` gives a clean slate (dev only; in v7 it no longer runs seeds) [12]. With the fresh-user-per-test strategy, `deploy` is enough.
- The hand-written partial index lives in a migration's SQL, so `migrate deploy` applies it. `db push` would not, because it works from the schema **(analysis)**. Never use `db push` for the test DB.

## 5. Risks and open questions

- **Prisma upgrade path.** Upgrading to ≥ 7.5 changes nested-`$transaction` behaviour [4]. Upgrading to ≥ 7.10 changes the P2002 `meta` for `adapter-pg` [10]. Pin `prisma` to `^7` until a deliberate move to v8, whose transaction API differs [9]. The current `^7.2.0` already does this.
- **Behaviour on 7.2 when the module receives a tx client and calls `$transaction` on it** is unverified. Write one test for it, or design the module to never call `$transaction` on an injected `db` (accept either a client or a tx, and start the transaction only at the top-level call site).
- **PGlite vs Postgres 16.** PGlite is on PG 18.6. The adapter's compatibility with PGlite 0.5.x and Prisma 7.2 is untested by me, and its peer range is open-ended (`>=0.2.0`) [16].
- **Bun 1.3 patch level** and `@node-rs/argon2` under the Bun runtime are unverified. Neither matters if Vitest runs on Node.
- **`pg` pool size under `@prisma/adapter-pg`** (needed for the race test) was not checked in the adapter docs.
- **Timezones.** Set `TZ=UTC` (or a fixed zone) for the test process, so that `AT TIME ZONE` assertions don't depend on the developer's machine. This is easiest under `forks` [21].
- **Testcontainers on Windows** has no specific notes in its docs [20]. Docker Desktop is assumed.
- **Vitest 5.1** is two days old. Vitest 4 (`vitest-mock-extended` peer `>=4` [42]) is a reasonable choice if 5.x shows teething problems. Note the `VITEST_POOL_ID` base change [23].

## 6. Sources

1. Prisma docs (v7), Integration testing: https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing
2. Prisma docs, Unit testing: https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing
3. Prisma docs (v7), Database drivers (official vs community adapters): https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers
4. Prisma 7.5.0 release notes: https://github.com/prisma/prisma/releases/tag/7.5.0
5. Prisma changelog, 2026-03-11 (v7.5.0): https://www.prisma.io/changelog/2026-03-11
6. prisma/prisma PR #21678, nested transaction rollbacks via savepoints (merged 2026-02-19): https://github.com/prisma/prisma/pull/21678
7. Prisma issue #30755, array-form `tx.$transaction([...])` commits independently (opened 2026-10-16, open): https://github.com/prisma/prisma/issues/30755
8. Prisma docs (v7), Transactions (timeouts, isolation, P2034): https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions
9. Prisma docs, Release status (v7 stable, v8 RC; snapshot 2026-11-03), plus the current transactions page (v8): https://www.prisma.io/docs/orm/release-status and https://www.prisma.io/docs/orm/prisma-client/queries/transactions
10. Prisma 7.10.0 release notes (adapter-pg P2002 constraint names): https://github.com/prisma/prisma/releases/tag/7.10.0
11. Prisma docs, Prisma Config reference (`env()`, dotenv, `--config`): https://www.prisma.io/docs/orm/reference/prisma-config-reference
12. Prisma docs, CLI reference (`migrate deploy`, `migrate reset`): https://www.prisma.io/docs/orm/reference/prisma-cli-reference
13. Prisma docs, Local development with Prisma Postgres (`prisma dev`, PGlite, one connection): https://www.prisma.io/docs/postgres/database/local-development
14. lucasthevenet/pglite-utils repository: https://github.com/lucasthevenet/pglite-utils
15. pglite-prisma-adapter README: https://github.com/lucasthevenet/pglite-utils/blob/main/packages/prisma-adapter/README.md
16. npm registry, pglite-prisma-adapter (0.7.2, 2026-01-17): https://registry.npmjs.org/pglite-prisma-adapter
17. PGlite docs, overview (single exclusive connection): https://pglite.dev/docs/
18. PGlite docs, PGlite Socket: https://pglite.dev/docs/pglite-socket
19. Testcontainers for Node, PostgreSQL module: https://node.testcontainers.org/modules/postgresql/
20. Testcontainers for Node, Supported container runtimes: https://node.testcontainers.org/supported-container-runtimes/
21. Vitest docs, `pool` config: https://vitest.dev/config/pool
22. Vitest docs, `globalSetup` (page shows v5.1.0): https://vitest.dev/config/globalsetup
23. Vitest docs, Migration guide (v5 requirements, `VITEST_POOL_ID` from 1): https://vitest.dev/guide/migration/
24. Vitest docs, `setupFiles` (`VITEST_POOL_ID`): https://vitest.dev/config/setupfiles.html
25. Bun docs, Test runner (page shows v1.4.4): https://bun.com/docs/test
26. Bun v1.3.13 release notes (2026-04-20, `--parallel`, `--isolate`): https://bun.com/blog/release-notes/bun-v1.3.13
27. Bun docs, Node-API: https://bun.com/docs/runtime/node-api
28. Bun docs, Node.js compatibility: https://bun.com/docs/runtime/nodejs-compat
29. Bun docs, Module resolution (tsconfig `paths`): https://bun.com/docs/runtime/module-resolution
30. Bun docs, `bun run` (shebang / `--bun`): https://bun.com/docs/cli/run
31. chax-at/transactional-prisma-testing README: https://github.com/chax-at/transactional-prisma-testing
32. prisma/web PR #7922, transactional integration test guidance (closed unmerged 2026-09-16): https://github.com/prisma/web/pull/7922
33. PostgreSQL 16 docs, TRUNCATE: https://www.postgresql.org/docs/16/sql-truncate.html
34. PostgreSQL 16 docs, Template databases: https://www.postgresql.org/docs/16/manage-ag-templatedbs.html
35. PostgreSQL 16 docs, Tutorial: Transactions: https://www.postgresql.org/docs/16/tutorial-transactions.html
36. PostgreSQL 16 docs, SAVEPOINT: https://www.postgresql.org/docs/16/sql-savepoint.html
37. Kent C. Dodds, "Write tests. Not too many. Mostly integration." (2019-07-13): https://kentcdodds.com/blog/write-tests
38. Martin Fowler, "IntegrationTest" (2018, updated 2021): https://martinfowler.com/bliki/IntegrationTest.html
39. Software Engineering at Google, ch. 13 "Test Doubles": https://abseil.io/resources/swe-book/html/ch13.html
40. Google Testing Blog, "Increase Test Fidelity By Avoiding Mocks" (2024-02-27; body not retrieved, summary from a search snippet): https://testing.googleblog.com/2024/02/increase-test-fidelity-by-avoiding-mocks.html
41. dotenv README (no override of existing env vars): https://github.com/motdotla/dotenv
42. npm registry metadata, read 2026-11-05: https://registry.npmjs.org/vitest, https://registry.npmjs.org/vitest-mock-extended, https://registry.npmjs.org/prisma-mock, https://registry.npmjs.org/@electric-sql/pglite, https://registry.npmjs.org/@testcontainers/postgresql, https://registry.npmjs.org/@chax-at/transactional-prisma-testing
43. TanStack Start docs, Path aliases (Vite 8 `resolve.tsconfigPaths`): https://tanstack.com/start/latest/docs/framework/react/guide/path-aliases
44. Martin Fowler, "TestDouble" (2006): https://martinfowler.com/bliki/TestDouble.html
