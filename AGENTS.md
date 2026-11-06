# AGENTS.md

This file gives coding agents guidance for working in this repository. `CLAUDE.md` imports it (`@AGENTS.md`), so the same guidance loads on every OS.

Setlist is a strength training log: users manage a library of movements, log sets (movement, weight, reps) in a current workout, and review completed workouts in their history. `README.md` describes the product and the open feature requests.

`CONTEXT.md` is the domain glossary. Use its terms in code, UI copy, and commits (for example "Load", not "effective weight"). `docs/adr/` records decisions that are hard to reverse. Read the matching ADR before changing movement ownership, weights, body-weight sets, progression queries, passwords or sessions, workout constraints, the test setup, or where files live.

## Commands

Use **Bun** for everything.

- `bun install`: install dependencies. Also generates the Prisma client (`postinstall`) and installs git hooks (`prepare`).
- `bun run dev`: start Postgres and the app in Docker with watch mode at http://localhost:3000. The container runs `bun run db:prepare` on start.
- `bun run dev:down`: stop the Docker services
- `bun run db:migrate --name <change>`: create and apply a migration against the Docker Postgres (`localhost:55432`)
- `bun run db:reset`: drop the database and re-apply all migrations
- `bun run db:prepare`: apply pending migrations, then hash any legacy plaintext passwords. The app container runs it on start.
- `bun run typecheck`: generate the route tree and run `tsc --noEmit`
- `bun run build`: production build
- `bun run test`: Playwright e2e tests against the running app. Run `bunx playwright install chromium` once before the first run.
- `bun run test:integration`: Vitest integration tests (`src/**/*.test.ts`) against the `setlist_test` database on the Docker Postgres, created and migrated on the first run (ADR 0008).

## Architecture

- **Framework**: TanStack Start (React SSR) with Vite and Nitro
- **Routing**: TanStack Router, file-based, in `src/routes/`. `src/routeTree.gen.ts` is generated and gitignored.
- **Domain folders (ADR 0010)**: each domain concept lives in `src/lib/<domain>/`:
  - `index.ts`: the deep module, server only, wrapped in `createServerOnlyFn`
  - `<domain>.functions.ts`: the `createServerFn` adapters. Protected ones use `authMiddleware`, which puts `context.user` on the request.
  - `queries.ts`: the key factory, `queryOptions`, and `mutationOptions` with `meta.invalidates`
- **Server state**: TanStack Query. Route loaders call `queryClient.ensureQueryData(...)` and components read the same data with `useSuspenseQuery`.
- **Legacy locations**: until the query refactor lands, some existing code still sits in route `-queries/` folders and in `src/lib/*.server.ts` (including `authMiddleware` in `src/lib/auth.server.ts`). Write new code in the domain folders.
- **Auth**: an HMAC-signed session cookie holding the user ID, set in `src/lib/auth.server.ts`. Signed-in routes live under `src/routes/__index/_layout*`, and the layout redirects to `/sign-in` when there's no user.
- **Database**: PostgreSQL with Prisma 7 through the `@prisma/adapter-pg` driver adapter. The schema is `prisma/schema.prisma`, and the client is generated into `prisma/generated/` (gitignored). Get a client with `getServerSidePrismaClient()` from `src/lib/db.server.ts`.
- **Styling**: Tailwind CSS v4. The brand color is `--color-primary` in `src/styles.css`. Small hand-rolled UI primitives live in `src/components/ui/`.
- **New screen or substantial UI rework**: run `/prototype` to validate layout and flow, then `/impeccable` for the final design. Keep the identity the existing screens already set: slate neutrals, white cards, `--color-primary` as the accent, `lucide-react` icons, and the primitives in `src/components/ui/`.
- **Path alias**: `@/*` maps to `src/*`.

## Configuration

- `.env` is committed and holds the non-secret local development defaults (`DATABASE_URL`, `COOKIE_SECRET`, `VITE_ENVIRONMENT`, `ENVIRONMENT`). Overrides go in `.env.local`, which is gitignored.
- In Docker, the app reaches Postgres at `postgres:5432`. From the host, Postgres is at `localhost:55432`.
- The app container syncs `src/` and `public/` and rebuilds when `prisma/`, `package.json`, or `bun.lock` change.

## Conventions

- Commits must follow Conventional Commits. The commitlint `commit-msg` hook enforces this.
- Pushing to `main` runs `bun run typecheck` through the `pre-push` hook.
- Never reference issue-tracker IDs (such as `ABC-123`) in code, comments, docs, commit messages, PR titles or bodies, or branch names. Readers of the repo can't open the tracker. To point at the reasoning behind a change, cite the matching ADR (for example `ADR 0005`). Where no ADR exists, describe the change in words or cite the PR number (`#8`).
- Name branches `type(scope)/description`, using the Conventional Commits type of the main change, for example `fix(security)/hash-passwords-with-argon2id` or `chore/test-infra`.
