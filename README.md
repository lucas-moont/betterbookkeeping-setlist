# Setlist

**A no-nonsense strength training log.**

Setlist is for people who lift. You open it at the gym, start a workout, and log every set as you go: the movement, the weight, and the reps. When you're done you mark the workout complete and it moves into your history.

## Where the product is today

The first version covers logging:

- **Accounts**: users can create an account and sign in with email and password.
- **Movements**: users build up a library of the exercises they do, like "Bench Press", "Back Squat", or "Dumbbell Curl".
- **Current workout**: users start a workout, add sets (movement, weight, reps), remove mistakes, and complete the workout.
- **Workout history**: users review completed workouts and delete ones they don't want to keep.

Logging works, but users can't see whether they're getting stronger. They also can't log body-weight training properly. The next milestone is about **progress**, and that milestone is your assignment.

## Your assignment

1. **Body weight tracking.** Let users record their body weight so they can track it over time. Show a chart of their body weight history.

2. **Body-weight movements.** Pull-ups, push-ups, and dips don't fit the current model well. When creating a movement on the Movements page, let the user flag it as **body-weight**. When a body-weight movement is added to the current workout, the weight field should default to the user's most recently recorded body weight.

3. **Progression charts.** Workout history should show users how they're progressing. Add a chart where the user picks a movement and a metric, then sees that metric plotted over time. Metrics:
   - **Max weight**: the heaviest weight lifted for that movement on a given day
   - **Total reps**
   - **Total volume**: the volume of a set is `weight × reps`, and the total volume for a movement is the sum across all of its sets in a workout

4. **End-to-end tests.** There aren't any yet. Implement the skipped test cases in `e2e/` with Playwright. The scaffolding is in place:
   - `e2e/movements.spec.ts`: creating and listing movements
   - `e2e/sets.spec.ts`: adding, listing, and removing sets
   - `e2e/workouts.spec.ts`: starting, completing, listing, and deleting workouts

5. **Security fix.** Passwords are currently stored in plaintext. Hash them with a secure algorithm such as bcrypt or argon2, and update sign-up and sign-in to match.

### Stretch goals

- **Nutrition**: how would you add nutrition tracking? Consider macros (carbs, protein, fat), calories, and a calorie surplus or deficit.
- **Data model and performance**: tell us what we're doing wrong, then show us how you'd handle harder problems such as an admin board that summarizes the users in the system.
- **Security**: beyond password hashing, what would you improve? Consider rate limiting, CSRF protection, and session management.
- **UI polish**: the UI is very basic. Show us how you'd make it look clean and professional.

### What happens next

There will be a code review of your work, so be ready to explain how you implemented each feature and why you made the choices you did.

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) for your commit messages, for example `feat(movements): add body-weight flag`. A git hook checks every commit message.

## Getting started

### Prerequisites

- [Bun](https://bun.sh) 1.3 or newer
- [Node.js](https://nodejs.org) 22 or newer. Playwright's test runner needs Node, and without it `bun run test` exits without running anything.
- Docker with Compose 2.24 or newer, for example Docker Desktop or OrbStack

### Setup

```bash
# Install dependencies. This also generates the Prisma client and installs the git hooks.
bun install

# Start Postgres and the app in Docker with hot reload.
bun run dev
```

Open http://localhost:3000 and create an account. Every time the app container starts, it runs `bun run db:prepare`: it applies pending database migrations, then converts any legacy plaintext passwords to argon2id hashes (a no-op once every password is hashed).

Stop everything with `bun run dev:down`.

Both commands run `scripts/dev.ts` with Bun, not a shell script, so they work the same on Windows, macOS and Linux.

### Running the e2e tests

```bash
# One time: download the browser Playwright drives.
# On Linux, use `bunx playwright install --with-deps chromium` to also install system libraries.
bunx playwright install chromium

# Run the suite. The app must be running (bun run dev).
bun run test
```

To run the suite against another server, such as the production build, set `PLAYWRIGHT_BASE_URL` in your shell (for example `PLAYWRIGHT_BASE_URL=http://localhost:3100 bun run test`).

Every test signs up its own brand-new user through `e2e/fixtures.ts`, so the suite runs in parallel and needs no cleanup. The movements the tests create stay in the database, each with a random suffix in its name. `bun run db:reset` clears them.

### Running the integration tests

```bash
# Postgres must be running (bun run dev).
bun run test:integration
```

The integration tests use Vitest against a real `setlist_test` database on the Docker Postgres. The first run creates it and applies the migrations. To point the tests at another database, set `TEST_DATABASE_URL` in your shell (`.env.local` doesn't apply here). The database name must end in `_test`.

### Changing the database schema

1. Edit `prisma/schema.prisma`.
2. Create and apply a migration: `bun run db:migrate --name describe-your-change`. This runs against the Docker Postgres and regenerates the Prisma client on your machine.
3. The app container watches `prisma/`, so it rebuilds on its own and picks up the new client.

To wipe the database and re-apply every migration, run `bun run db:reset`.

### Configuration

The committed `.env` file holds every value needed for local development. None of them are secrets. To override a value for the app, put it in a `.env.local` file, which is gitignored.

| Service  | Address                                                  |
| -------- | -------------------------------------------------------- |
| App      | http://localhost:3000                                    |
| Postgres | `postgresql://postgres:postgres@localhost:55432/setlist` |

Postgres listens on host port `55432` instead of `5432` so it doesn't conflict with a Postgres you may already have installed.

### Scripts

| Script                       | What it does                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `bun run dev`                | Start Postgres and the app in Docker with watch mode                                       |
| `bun run dev:down`           | Stop the Docker services                                                                   |
| `bun run db:migrate`         | Create and apply a Prisma migration                                                        |
| `bun run db:reset`           | Drop the database and re-apply all migrations                                              |
| `bun run db:prepare`         | Apply pending migrations and hash legacy passwords                                         |
| `bun run db:explain-indexes` | EXPLAIN the main queries with and without the foreign-key indexes, on a throwaway database |
| `bun run typecheck`          | Type-check the project                                                                     |
| `bun run build`              | Build for production                                                                       |
| `bun run test`               | Run the Playwright e2e tests                                                               |
| `bun run test:ui`            | Run the e2e tests in Playwright's UI mode                                                  |
| `bun run test:integration`   | Run the Vitest integration tests against `setlist_test`                                    |
| `bun run format`             | Format the code with Prettier                                                              |

## Tech stack

- **Framework**: TanStack Start (React SSR)
- **Routing**: TanStack Router (file-based)
- **Data and forms**: TanStack Query and TanStack Form
- **Database**: PostgreSQL and Prisma
- **Styling**: Tailwind CSS v4
- **Runtime**: Bun
- **Testing**: Playwright (e2e) and Vitest (integration, against a real Postgres)

## Project structure

```
src/
├── routes/        # File-based routes: pages, loaders and local UI state
│   └── <route>/-components/  # Pieces only that page uses (the "-" keeps them out of the routes)
├── components/
│   ├── ui/        # Small UI primitives (Button, Card, Input, Select, Alert, Dialog)
│   └── charts/    # TimeChart: the one line chart over time, shared by every chart screen
└── lib/
    ├── <domain>/  # One folder per concept (auth, movements, workouts, body-weight, progression), with
    │              #   index.ts               the domain rules (server only)
    │              #   <domain>.functions.ts  server functions
    │              #   queries.ts             query keys, queries and mutations
    ├── error-codes.ts  # Every error code a domain can return, with its message
    ├── weight.ts       # load(): the one Load formula
    └── db.server.ts    # Prisma client (server only)
src/test/          # Integration test setup and factories
prisma/
├── schema.prisma  # Database schema
└── migrations/    # Database migrations
e2e/               # Playwright tests
```

## Changes to the starter code

### Removed unused code

Nothing in the repo used these, so they were deleted:

- `src/lib/utils.ts`: everything except `cn` (`typedKeys`, `pick`, `assertExists`, `truthyMap`, `levenshteinDistance`, `stringSimilarity`)
- `src/lib/types.ts` (`UnwrapAsyncIterator`, `UnionToIntersection`, `Prettify`)
- `src/components/ui/dropdown-menu.tsx`

Code that looks important but that nothing calls slows down anyone reading the project. Before deleting it, each item was checked against the assignment above, and none of the planned features needs it:

- The progression chart's movement and metric pickers are form fields, which `src/components/ui/select.tsx` already covers. The dropdown is an action menu (`role="menu"`), not a form field.
- Deleting several workouts from history already works with checkboxes and a button, so the e2e cases in `e2e/workouts.spec.ts` don't need a menu either.
- The empty-workout prompt researched in `docs/research/empty-workouts.md` needs a dialog, not a menu.
- No feature asks for fuzzy matching of movement names. If a "did you mean…?" prompt is ever needed, `levenshteinDistance` is still in the git history.

### End-to-end tests

Every skipped case in `e2e/movements.spec.ts`, `e2e/sets.spec.ts` and `e2e/workouts.spec.ts` now runs, and the suite has no skipped test. Two of them waited for data the app didn't store yet:

- "should show sets in the order they were added" runs since sets record when they were added (see "Planned and completed sets" below).
- "should show the workout date after starting" runs since workouts record when they started (see "One Current Workout per user, and the day it started" below). Before, the card showed today's date, so the test would have passed without proving anything.

How the suite is built, and why:

- **One user per test.** `e2e/fixtures.ts` signs every test in as a new user, the same rule as the integration tests (ADR 0008). Tests own their data, so they can run in parallel.
- **Setup through the UI.** `e2e/helpers.ts` creates movements, starts and completes workouts, and adds sets by clicking through the app, the way a user would.
- **Exact lists.** Each test signs in as a new user, and since ADR 0001 a user only sees their own movements, so a test can check that the list equals its movements. Before, every user shared one library and parallel tests kept adding to it, so a test could only check that the list contained its movements.
- **Accessible names.** The movement name input, the set form fields, the icon-only "Remove set" button and the history checkboxes had no accessible name, so screen readers announced them as unnamed controls. They now have `aria-label`s, which is also how the tests find them. Nothing changes visually.
- **Each test was seen failing.** For behavior that already worked, each group of tests was run against a temporarily broken app (for example, the movement list sorted backwards, or a server that skips deleting the set) to prove the tests catch the bug. Pull request #13 lists every one.
- **Technical debt: a warm-up before the suite.** Right after the dev server starts, a few parallel sign-ups used to fail with "action is not a function". The cause is in Vite 7's SSR module runner: when two requests load the same module at once, the second one can get its exports before they are filled in ([vitejs/vite#22369](https://github.com/vitejs/vite/pull/22369)). The fix shipped in Vite 8.0.12 and was not backported to 7.x ([Vite 7 changelog](https://github.com/vitejs/vite/blob/v7/packages/vite/CHANGELOG.md)). The proper fix is to upgrade to Vite 8.0.12 or later. That is a major upgrade (Vite 8 bundles with Rolldown, and TanStack Start and Nitro may need to move with it), so for the delivery deadline `e2e/global-setup.ts` signs up once and opens every signed-in page before the workers start, which loads each module one request at a time. The production build the CI tests against is not affected. After the upgrade, delete `e2e/global-setup.ts` and `globalSetup` in `playwright.config.ts`.

### Code organized by domain, and cache invalidation declared on each mutation

Before, each page decided on its own what to refresh after a change: every `onSuccess` called `invalidateQueries` with a hand-typed key, and `movementsQueryOptions` was copied into two route folders. The upcoming features make one change affect several screens (completing a workout changes the history and the progression charts), so that rule now lives in one place (ADR 0010).

- **One folder per concept.** `src/lib/auth`, `movements`, `workouts` and `progression` hold the server functions (`<domain>.functions.ts`) and the TanStack Query side (`queries.ts`), whichever each one needs today: `auth/` has no queries, and `progression/` only has its key root until the charts exist. The route `-queries/` folders are gone. Code that must never reach the browser keeps the `.server.ts` suffix and is used only inside server-function handlers: the session cookie code moved to `src/lib/auth/session.server.ts`, and a production build was checked to leave the signing secret out of the client bundle. Sessions have since moved to the database, with nothing left to sign (see "Sessions in the database, and one account per email address" below).
- **Keys form a tree.** `["workouts", "current"]` and `["workouts", "history"]` share the `["workouts"]` root, so a mutation can refresh both with one prefix.
- **Each mutation says what it makes stale.** For example, `completeWorkoutMutationOptions` declares `invalidates: [workoutKeys.all, progressionKeys.all]` (through `serverMutationOptions`, which stores it in `meta.invalidates`). One `MutationCache` `onSuccess` in `src/router.tsx` reads that list. Pages only keep their own form resets, such as clearing the reps field.
- **A mutation stays pending until the screen shows the new data.** The global `onSuccess` returns the invalidation promise, as the TanStack Start guide's example does. Before, "Adding..." turned back into "Add", and the reps field was cleared, while the new set was still missing for one round trip. Now the label, the cleared field and the new row change together. Only the queries on screen refetch, so invalidating the history from the workout page costs nothing, and a failed refetch never turns a saved set into an error. The reasoning and sources are in `docs/research/mutation-invalidation-and-auth-flows.md`.
- **Sign-in, sign-up and logout stay plain server-function calls.** The signed-in user lives in the router context, not in the query cache, so a mutation would have nothing to invalidate. The official Start auth examples call the function directly, too. Logout stays a full page load, which also throws away the previous user's cached data.

Completing a workout now also invalidates the history. Since queries refetch whenever a page mounts, this changes nothing you can see today. It matters once some data is cached for longer.

### Workout rules in one module, tested against a real Postgres

Each workout server function used to do everything itself: validate the input, run one Prisma call, and work out on its own which workout was the user's open one. That rule was written four times, and the only tests were the e2e suite. The next features (one open workout per user, the empty-workout prompt, body-weight Sets) all add rules in exactly that spot. So the rules moved first, in a refactor that changes no behavior (ADR 0010).

- **One module.** `src/lib/workouts/index.ts` has seven operations: `start`, `get`, `addSet`, `removeSet` and `complete` for the Current Workout, plus `history` and `deleteWorkouts`. Each one takes `(db, userId, ...)`, so a caller can pass a transaction, and each one only touches that user's rows. The server functions keep their names and become thin adapters: auth, zod validation, the module call, and the error translation. The routes didn't change.
- **One definition of "Current Workout".** `currentWorkoutWhere(userId)` is the only place that says "this user's workout with no completion time". Before, `get` sorted the open workouts and `addSet` and `complete` didn't, so a user with two open workouts could add a Set to the one the screen wasn't showing. Now all three pick the same one. Since then, a partial index allows only one per user (ADR 0006, see "One Current Workout per user, and the day it started" below).
- **Errors as values.** Expected failures (`no-current-workout`, `set-not-found`) come back as `{ ok: false, reason }`. Their messages live in `src/lib/error-codes.ts`, and `toServerResult` turns them into the `{ success, code, error }` that reaches the browser. Removing a Set of a Completed Workout, or of another user, returns the same `set-not-found` as an id that doesn't exist, so the answer never reveals which ids are taken. Database errors still throw. An unknown movement used to be one of them; since movements have an owner, `addSet` returns `movement-not-found` instead (see below).
- **Less data to the browser.** The module selects only the columns the screens use, so `userId` and the foreign-key ids no longer leave the server. Sets also carry their `load`, computed by `load()` in `src/lib/weight.ts`, the one Load formula. The screens still show `weight`, which is the same number until body-weight Sets exist.
- **Integration tests through the module.** `src/lib/workouts/workouts.test.ts` runs every operation against the `setlist_test` database, one new user per test, and checks outcomes through `get` and `history`, never by reading tables. The cases come from `docs/research/current-workout-test-scenarios.md`: every authorization test uses two users, and every invalid action, such as completing twice or removing a Set of a Completed Workout, checks both the error and that nothing changed. As in #13, each guard was broken by hand once to watch its test go red. One of those runs found a gap: no test failed when `addSet` wrote into a completed workout, so a test for it was added.
- **Kept as it was, on purpose.** `start` still created a workout every time (it returns the Current Workout since ADR 0006 landed), `complete` still finds and then updates, and `deleteWorkouts` still runs two statements without a transaction, because Prisma 7.2 can't nest one inside a caller's transaction. `deleteWorkouts` also accepts a Current Workout's id if one is sent straight to the server function. The screen never sends one, and the empty-workout flow will restrict it to Completed Workouts.
- **Test factories.** `src/test/factories.ts` creates users and movements with unique names. Factory users get a real argon2id hash, because since ADR 0005 every account stores one, and plaintext only exists as legacy data. That matters: `hashLegacyPasswords` scans the whole test database, so plaintext users left behind by earlier runs made its test slower until it timed out.

### Movements owned by each user

**The problem.** Every user shared one movement library, and the movement server functions had no sign-in check, so even a signed-out visitor could add to it. Assignment 2 puts the body-weight flag on the movement, and in a shared library one user flagging "Pull-up" would change every other user's sets and defaults. The README never says "each user has their own movements" in so many words, but "users build up a library of the exercises they do" and assignment 2 only work that way, and the stretch goals ask what the data model and security get wrong. This change is the foundation for assignment 2 (ADR 0001). It also turns the e2e test "should display all movements" into a real check (see above).

**What changed for the user.**

- Each user sees and uses only their own movements, on the Movements page and in the Current Workout picker.
- Names are unique per user, ignoring case and the spaces around them: "Bench Press", "bench press" and " BENCH PRESS " are the same movement. A taken name shows an error under the field, and the typed name stays so it can be fixed.
- Signed-out requests to the movement server functions get the redirect to sign-in.
- Failures now reach the screen. The server functions answered expected failures with `{ success: false }`, and the screens ignored it, so nothing happened and the cache was refreshed anyway. Now a refused set or workout action shows its message in a toast. An unexpected error (a database or validation error) shows "Something went wrong. Please try again.", because its raw text can name tables and columns.

**How.**

- **Schema.** `Movement` gets `userId`, `nameKey` and `createdAt`, with `@@unique([userId, nameKey])`. `nameKey` is the name trimmed and lower-cased by `movementNameKey()` in `src/lib/movements/name.ts`, and every write goes through the movements module, so it can't fall out of sync. `Set` gets indexes on `workoutId` and `movementId` in their own migration: Postgres doesn't index foreign keys on its own.
- **The migration is written by hand** (`prisma/migrations/20261106120000_movements_owned_by_user`). A plain `NOT NULL` column can't be added to rows that have no owner yet. In one transaction, it gives each user who logged sets with a movement their own copy, merges each user's case-duplicates into the one with the most of their sets (ties: the lowest id), moves every set to its owner's copy, and deletes the shared movements and the ones nobody used. The `Set` foreign key is `RESTRICT`, so a set left behind would abort the migration rather than be lost. On the local databases it turned 1586 shared movements into 713 owned ones with all 715 sets kept, and 423 into 290 with all 292 sets kept.
- **The migration test** (`src/test/migrations/movement-ownership.test.ts`) creates a throwaway database, applies the migrations before this one, inserts the hard cases with raw SQL (two users sharing a movement, case-duplicates with more and with equal sets, a name with spaces, an unused movement), applies only this migration and checks every set and movement. Breaking the merge rule on purpose turned it red.
- **The same key in code and in SQL.** The migration computes `nameKey` for existing rows in SQL, so the two definitions must agree, or a migrated "Bench Press" and a new "bench press" could both exist. `src/lib/movements/name.test.ts` runs the migration's own SQL functions against `movementNameKey()`. It caught two real differences: the regexp `\s` in Postgres misses the no-break space (pasted from web pages) but strips U+0085, which JavaScript keeps; and `lower()` follows the database's libc collation, which lower-cases a final "Σ" and a Turkish "İ" differently from JavaScript. The migration spells out the exact characters JavaScript's `trim()` removes and lower-cases with the ICU collation.
- **The movements module** (`src/lib/movements/index.ts`, ADR 0010) has `create`, `list` and `ensureOwned`, each taking `(db, userId, ...)`. `create` uses `INSERT ... ON CONFLICT DO NOTHING`, so a double click adds one row, and nothing throws inside a transaction the caller passed in (the reason ADR 0006 avoids catching P2002). `list` selects only `id` and `name`, so `userId` and `nameKey` never reach the browser. Editing a movement came with the body-weight flag, and keeps `nameKey` in sync the same way (see "Body-weight movements, and editing a movement" below).
- **`addSet` checks the movement's owner.** Another user's movement gets the same `movement-not-found` as an id that doesn't exist, so the answer never reveals which ids exist. Before, Postgres rejected the unknown id and the screen showed Prisma's raw error. Ids sent to the workout server functions are now validated as UUIDs.
- **One way to build a mutation.** `serverMutationOptions()` in `src/lib/server-mutation.ts` turns a `{ success: false }` into a thrown `ServerResultError` and takes the keys to invalidate, so a new mutation can't forget either. The toast moved to `MutationCache.onError`, which runs for every mutation. A mutation lists in `formErrors` the codes its form shows by itself (the Movements form lists `movement-name-taken`), and `isFormError()` makes that decision for both the toast and the form. The form and the server function share `movementNameSchema` (trimmed, 1 to 100 characters).

**Tests.** Unit: the name key and schema, `unwrap`, `isFormError` and the toast message. Integration: user A doesn't see B's movements, case-duplicates and a double submit are refused, `addSet` refuses another user's movement. E2E: the exact list, the form error, a second user who sees none of the first user's movements, and a create replayed without the session cookie. Each new guard was broken on purpose once to watch its test fail.

**Kept as it was, on purpose.** Logging out still doesn't revoke the signed session cookie, so a copied cookie keeps working; sessions stored in the database fix that (ADR 0009). Reps and weight were still any number of at least 1 and 0; they got bounds with decimal pounds (see below).

### Weights in decimal pounds

**The problem.** `Set.weight` was an integer, so a 135.5 lb set couldn't be logged. The form also parsed the field with `parseInt`, which cut any decimals off without a word. Assignments 1 and 2 need decimals too, because a body weight like 172.4 lb will fill in the weight of a body-weight set, so both have to share one type and one unit (ADR 0002).

**What changed for the user.**

- The weight field takes up to two decimals, from 0 to 9999.99 lb, and the set shows the weight as logged ("5 reps × 135.5 lbs"), in the Current Workout and in the history.
- A weight with three decimals, such as 1.005, is refused by the browser instead of being rounded.
- Reps must be a whole number from 1 to 999. Before, 1.5 passed validation and then failed in Postgres.

**How.**

- **Storage.** `Set.weight` is a Postgres `numeric(6,2)` (Prisma `Decimal @db.Decimal(6, 2)`). The migration is a single `ALTER COLUMN ... SET DATA TYPE DECIMAL(6,2)`, which keeps every value. On the local database, the 751 sets had the same count, sum (120786), maximum (315) and per-set fingerprint before and after.
- **Why not integer hundredths of a pound, like money in cents?** It is just as exact: every value from 0.00 to 9999.99 survives the round trip either way. But every write would multiply by 100, every read and raw SQL expression would divide by 100, and every future weight column would repeat that. Floats were ruled out because no CHECK can enforce two decimals on them. The comparison and its sources are in `docs/research/weights-decimal-pounds.md`.
- **Numbers, not `Decimal`, leave the module.** Prisma returns `Decimal` objects, and TanStack Start can't serialize them, so a leak would fail the server function. `toSet()` in `src/lib/workouts/index.ts` turns the weight into a `number` before `load()` runs. Two decimals always fit a JS number exactly, so nothing is lost.
- **Validation refuses instead of rounding.** The column would round 1.005 to 1.01 and overflow above 9999.99, so validation is the gate. `weightSchema` in `src/lib/weight.ts`, next to `load()`, is the one rule for every weight field: at most 9999.99, and a value that rounding to two decimals would change is refused. The body-weight features reuse it, each with its own minimum. zod's `multipleOf(0.01)` was not enough on its own: it has no upper bound and lets `1e-7` through. The form takes `maxWeight` and `weightStep` from the same file, and sends `Number(...)` for both fields, so the schema sees exactly what was typed.
- **For the Progression Charts.** Raw SQL gets `Decimal` back for `numeric` and `BigInt` for `sum(integer)`, so the per-Training-Day query will cast its results to `::float8` and `::int` (ADR 0002, ADR 0004).

**Tests.** Unit: `weightSchema` accepts 0, 0.07, 1.15, 135.55, ±9999.99 and -20.05, and refuses 1.005, `1e-7`, `0.1 + 0.2` and ±10000. The Set draft also refuses a negative Weight, and accepts 1 to 999 Reps but not 0, 1.5 or 1000. Integration: 135.55, 0.07 and 9999.99 come back from `addSet` and `get` as the same numbers. E2E: a 135.5 lb set survives a reload and shows in the history, and 1.005 is refused. Removing the conversion or the two-decimal check turned their tests red.

**Kept as it was, on purpose.** The screens still say "lbs" and print the number as it comes. One place that formats weights (as "135.5 lb") came next, with the shared date formatting (see below). The history's per-movement maximum still reads `weight`. It is the same number as Load until body-weight sets exist, and switches to Load with them.

### Dates and weights formatted in one place, in the browser's time zone

**The problem.** Each screen formatted its own dates with `toLocaleDateString("en-US", ...)` and wrote "lbs" by hand. Worse, the server renders the page in the container's zone, UTC. A workout completed at 22:00 in São Paulo (01:00 UTC the next day) showed up as the next day in the first paint, and the browser then disagreed with the server while hydrating. Assignments 1 and 3 make this matter more: a body weight logged today, and a Training Day on the progression chart, are days in the user's zone, not the server's (ADR 0004).

**What changed for the user.**

- Dates are the day they were where the user is: the Current Workout title and the history's dates follow the browser's time zone, on the server render too.
- Weights read "135.5 lb", with thousands grouped ("9,999.99 lb"), as `CONTEXT.md` spells the unit.

**How.**

- **One formatter.** `src/lib/format.ts` holds the locale and turns values into text: `formatWeight`, `formatDate` (an instant, such as `completedAt`, in a given zone), and for the coming body weight and progression screens, `todayIsoDate` and `formatCalendarDate` for "YYYY-MM-DD" days. A calendar day is never read as UTC midnight, which São Paulo would show as the day before. No screen calls `toLocaleDateString` or writes the unit.
- **The zone travels in a cookie.** The browser stores `Intl.DateTimeFormat().resolvedOptions().timeZone` in a `tz` cookie. The root route reads that same cookie on the server render and in the browser (`src/lib/time-zone.ts`), and screens get it from `useTimeZone()`, so both sides format with the same zone and agree.
- **First visit.** With no cookie yet, the server renders in UTC. The browser then writes the cookie and invalidates the router, so the same page re-renders in the user's zone right away.
- **Hydration reads the server's zone.** On a slow device the root writes the cookie before a lazily loaded route (Current Workout, Workout History, Profile) has hydrated, and that route used to hydrate with the browser's dates against the server's UTC HTML. While React hydrates, `useTimeZone()` now returns the zone the page was rendered in, read from the cookie when the module loads, and switches to the router's zone right after (`useHydrated`, ADR 0004). Only the time zone gets this: it is the one value of the root context that changes on that first-visit invalidate.
- **The cookie is untrusted input.** A bad value can't break a page: the zone is checked by trying it in `Intl` (not against `Intl.supportedValuesOf`, which leaves out "UTC" and "Asia/Kolkata"), its length is capped, offsets such as "+05:30" are refused (Postgres reads them with the sign flipped, which would move Training Days), and anything invalid falls back to UTC.

**Tests.** Unit: 01:00 UTC is Nov 6 in São Paulo and Nov 7 in UTC; today in São Paulo at 22:00 is "2026-11-06"; "2026-11-06" stays Nov 6 under São Paulo and Kiritimati process zones; `formatWeight` rounds `150.1 + 2.2` to "152.3 lb"; bad cookies such as "Mars/Olympus" or broken percent-encoding fall back to UTC. E2E, in two browsers set to Pacific/Kiritimati (UTC+14) and Etc/GMT+12 (UTC-12), which are never on the same date: the Current Workout title and the history date match the browser's day, the server's HTML has the same text, and React reports no hydration error. A first visit without the cookie renders UTC and then corrects itself; that test slows the page's CPU four times, which made the late route hydrate in the wrong zone every time before the hydration fix and never after it. Formatting the title with the server's zone, ignoring the cookie on the server, or dropping the re-render each turned a test red.

**Kept as it was, on purpose.** The interface stays in English, with the locale written once in `src/lib/format.ts`; translating it (for example with `use-intl`) is out of scope. The history's per-movement maximum still reads `weight`; it switches to Load with body-weight sets.

### Planned and completed sets, and a muscle group on each movement (back end)

**The problem.** A set only existed once it was done, so the history couldn't say whether a set the lifter meant to do was skipped. And nothing said what a workout trained: there was no way to tell a chest day from a leg day. Neither is one of the assignments, but both change the data the assignments build on, so they land first, in the back end only (ADR 0011). The screens arrive with the Movements page, Current Workout and Workout History reworks.

**What changes.**

- **A set is completed or planned.** Every set is still added completed, as "log every set as you go" describes, so logging stays one step and nothing on screen changes. A set can then be un-completed (a Planned Set) and completed again, only while its workout is the Current Workout. A Planned Set left in a Completed Workout stays in the history as not done. Only Completed Sets count toward metrics, set counts and a workout's muscle groups.
- **Several identical sets at once.** `addSet` takes a `count` from 1 to 10 (one by default) and adds them in one `INSERT`, so either all of them get in or none.
- **Sets keep their order.** They are listed in the order they were added, so tapping a set's circle can't make it jump in the list.
- **A Muscle Group on each movement.** One optional group from a fixed list: Chest, Back, Shoulders, Arms, Legs, Abs, Lower Back. Existing movements start without one.
- **A workout's muscle groups are derived, never picked.** They are the groups of the movements of its Completed Sets, once each, in the order of the list. Changing a movement's group changes every workout that used it, old ones included.

**How.**

- **Schema.** `Set.completedAt` (`NULL` is a Planned Set), `Set.createdAt`, and `Movement.muscleGroup`, a Postgres enum. Three migrations, one per change. The `completedAt` one is written by hand: it backfills every existing set with its workout's `completedAt`, or with the migration time for a workout still open, so no set becomes planned. On the local database, all 880 sets came out completed (386 with their workout's time, 494 of open workouts), and none planned.
- **A timestamp, not a boolean.** `completedAt` records when the set was done at no extra cost (ADR 0011). Only the server sees it; the module returns `completed: boolean`.
- **Order.** Sets are read by `createdAt`, then `id` (ADR 0007). `createdAt` arrived ahead of the rest of ADR 0007 because un-completing a set is an `UPDATE`, and Postgres can return an updated row in another position. Legacy sets got the migration time, so their order is only stable, and sets added in one request share a moment and fall back to `id`.
- **The workouts module.** `setCompleted(db, userId, setId, completed)` changes a set only in the user's own Current Workout. A set of a Completed Workout, of another user, or an id that doesn't exist all get the same `set-not-found`, like `removeSet`. A set already in that state is left alone, so a double click keeps the time it was completed. `get` and `history` return `muscleGroups`, computed in TypeScript from the rows they already load, so no query is added.
- **The movements module.** `create(db, userId, { name, muscleGroup? })`, and `setMuscleGroup(db, userId, movementId, muscleGroup | null)` for the owner only (ADR 0001). The list of groups comes straight from the enum Prisma generates (`prisma/generated/client/enums.ts`, which has no server code), through `src/lib/movements/muscle-group.ts`, and a test pins its order, which is the order a workout's groups come out in.
- **Ready for the screens.** Server functions validate ids as UUIDs and the group with the shared `muscleGroupSchema`. `setCompletedMutationOptions` refreshes the Current Workout; `setMuscleGroupMutationOptions` refreshes the movements and every workout, because their groups follow the movement.

**Tests.** Integration: a set is added completed; `count` adds identical sets; un-completing and completing again; a set already in that state is ok and unchanged; the list order survives toggling; a set of a Completed Workout or of another user is refused and left as it was; a Planned Set stays not done in the history; a workout's groups skip Planned Sets and movements without a group, don't repeat and follow the list order; changing a movement's group changes an old workout's groups; `setMuscleGroup` changes and clears the group and refuses another user's movement. Migration: in a throwaway database, sets of a completed workout get its time, sets of an open workout get the migration time, and none is planned. Unit: `count` accepts 1, 10 or no count, and refuses 0, 1.5 and 11; the groups keep the order of the list. The two migration tests now share one throwaway-database harness (`src/test/migrations/migration-test-database.ts`). E2E: "should show sets in the order they were added" now runs. Each guard was broken on purpose once to watch its test fail: the owner check of `setMuscleGroup`, the order, the Current Workout check of `setCompleted`, its "already in that state" answer, the backfill, and the completed-only filter of the groups.

**Kept as it was, on purpose.** `complete` doesn't look at Planned Sets yet; completing a workout with no Completed Sets will ask what to do with the empty-workout dialog. The history table still counts every set and shows no groups until its rework.

### Body weight on the Profile (assignment 1)

**The problem.** Assignment 1: users record their body weight and see a chart of its history. The body weight also feeds assignment 2, where a body-weight set takes the latest one.

**What changes.**

- **A Profile page.** The "Logged in as" block at the bottom of the menu becomes the way in, and shows as active while the Profile is open. The Profile has one section for now, Body Weight, so it has no sidebar of its own.
- **The Body Weight Chart.** One point per entry on a real time axis, from the first entry to today. A few weeks without an entry show as a gap, and recent days without an entry show as empty space on the right. With a single entry, the axis spans 14 days.
- **One entry per date.** The form records a weight for a date, today by default. Picking a date that already has an entry says so before submitting, and the button reads "Replace". Entries can be deleted from the list, which shows eight at a time.

**How.**

- **A table, not a column on `User`.** A column holds one value, so every new weight would overwrite the last and leave nothing to chart. `BodyWeightEntry` keeps one row per user per date, with a unique `(userId, date)` index, so two quick submits can't both add a row. The Latest Body Weight is the row with the newest date, which that same index serves, so nothing caches a copy of it.
- **The body-weight module** (`src/lib/body-weight/`, ADR 0010). It has four operations: `record` (an upsert on `(userId, date)`), `list` (newest first), `latest`, for the body-weight sets of assignment 2, and `remove` (another user's entry gets the same not-found as a missing one, ADR 0001). Dates go in and out as `"YYYY-MM-DD"` text (ADR 0004).
- **No future dates, in the user's zone.** An entry dated tomorrow would become the Latest Body Weight and be copied into every new set until that day came (ADR 0003). The form and the server both compare the date with the user's today from the `tz` cookie. An earlier plan let the server allow UTC today plus one day, from before the server knew the zone, and ADR 0003 now records the stricter rule.
- **One chart for the app.** `src/components/charts/time-chart.tsx` draws with `recharts`. It is the library the progression chart's plan already picked, so both charts look the same. The axis rules are pure functions in `time-axis.ts`. Recharts measures the DOM, so the chart renders in the browser only, inside a box the server already sizes, and nothing below it moves.
- **TanStack Form** for the record form, its first use in the app. Field errors show next to the field, and a future date the server refuses shows there too, not in a toast.

**Tests.** Integration: an entry comes back with its date as text and its weight as a number; recording the same date replaces it, keeping one entry; users don't see each other's entries; at 22:00 in São Paulo (already the next day in UTC), today is accepted and tomorrow refused; `latest` goes by date, not by order of recording; `remove` refuses another user's entry; deleting an entry leaves a Completed Set unchanged. Unit: the axis domain and ticks, the date and weight schemas, and the new date formats. E2E: the issue's "done when" through the UI (recorded today shows in the list, the Latest line and the chart; same date replaces; future date refused; delete; another user sees nothing), and the form's default date in two zones 26 hours apart, in the server HTML and the DOM, with no hydration error.

**Also fixed.** The `Card` primitive drew its border in `currentColor`, the Tailwind v4 default, so every card in the app had a black outline instead of the hairline DESIGN.md describes. The design review of the Profile caught it, and the fix reaches every screen. And the starter's `<body>` had `overflow-hidden`, so a page taller than the window couldn't scroll; the Profile was the first one that tall. The signed-in shell is now exactly the window's height: the sidebar stays put, with the user block always in view, and only the page content scrolls.

**Kept as it was, on purpose.** Phone layout and touch sizes come with the responsive layout work. Deleting an entry asks no confirmation, the same as removing a set.

### One Current Workout per user, and the day it started

**The problem.** Nothing stopped a user from having several Current Workouts: a double click on "Start Workout" started two, and the module picked one of them by sorting on a random UUID. And the Current Workout card showed today's date, not the day the workout started, so a workout left open overnight looked like today's.

**What changes for the user.**

- "Start Workout" with a workout already open returns that workout, with its sets. A double click starts one workout.
- The card shows the day the workout started, in the user's time zone. A workout from before start times were recorded shows no date rather than a guessed one (ADR 0007).

**How.**

- **The database decides (ADR 0006).** A partial unique index on `"Workout"("userId") WHERE "completedAt" IS NULL` allows one Current Workout per user. Prisma 7.2 can't express it, so it lives in the hand-written migration `20261107064500_one_current_workout`. Prisma doesn't introspect it either, so the migrations `prisma migrate dev` generates leave it alone. ADR 0006 expected them to drop it; generating one against a copy of the migrations showed they don't.
- **`start` inserts with `ON CONFLICT ... DO NOTHING`, then reads.** `INSERT ... ON CONFLICT ("userId") WHERE "completedAt" IS NULL DO NOTHING` through `$executeRaw`, then `get()`. Catching the unique violation (P2002) and reading again would abort a transaction the caller passed in, because Postgres aborts the whole transaction after an error. The `newestFirst` tie-break is gone: there is nothing left to break a tie between.
- **`Workout.startedAt`.** Every new workout records it; existing ones keep `NULL`, because nobody knows when they started (ADR 0007). Every read returns it.
- **The migration only touches users who need it.** The index can't be created while a user has two Current Workouts, so for those users only, it keeps open the one with the most sets (ties: the lowest id), deletes the extra empty ones, and completes the extra ones with sets at the migration time, so no set is lost. The first plan deleted every empty Current Workout. The index doesn't need that, and on the local database it would have deleted 471 workouts, each the only Current Workout of its user. Whether to keep or discard an empty workout is the user's choice (CONTEXT.md, Gym Visit), so a user with one Current Workout keeps it, empty or not.
- **Rehearsed before it ran.** The migration ran first on a restored copy of the local database, inside a transaction. Before and after, the counts were the same: 1025 Current Workouts (471 empty), 0 users with more than one, 465 Completed Workouts and 1040 sets. No user had two, so on the real local database the migration had nothing to sort out: it added the column and the index, and the migration test covers the cases it didn't meet.
- **An index on `("userId", "completedAt")`**, in its own migration, for the reads that filter a user's workouts by completion. It doesn't replace the partial index.

**Tests.** Migration (throwaway database): a user with an empty and a non-empty Current Workout keeps the non-empty one; with more and fewer sets, the one with more stays open even with the higher id, and the other is completed at the migration time; with two empty ones, the lower id stays; with the same set count, the lower id stays and the other is completed; a user with a single empty one keeps it; Completed Workouts are left as they were; no set is lost; a second Current Workout is refused by the index. Integration: `start` records `startedAt`; a second `start` returns the open workout with its sets; concurrent starts, each through its own Prisma client, start one workout (one client runs its queries one after another, so with a single client the starts never overlapped and a check-then-insert `start` passed); two starts inside a `$transaction` leave it usable; a legacy workout comes back with `startedAt: null`. E2E: "should show the workout date after starting" reads the card's date right after starting, moves the browser's clock two days ahead and comes back through the menu, so only a card that shows the start date passes, and a midnight during the test can't fail it; a double click on "Start Workout" waits for both answers and counts the toasts once, because `toHaveCount(0)` retries and passed as soon as the toast closed by itself. Each guard was broken on purpose to watch its test fail: the set-count ranking, deleting every empty Current Workout, a check-then-insert `start`, a `start` that catches P2002, a guessed `startedAt`, the dropped index, a plain insert behind the double click, and the old card.

**Kept as it was, on purpose.** Completing an empty workout still completes it; the choice between a Gym Visit and discarding it comes with the empty-workout dialog. `deleteWorkouts` still accepts a Current Workout's id sent straight to the server function, as before.

### Body-weight movements, and editing a movement (assignment 2, first half)

**The problem.** Assignment 2: pull-ups, push-ups and dips don't fit a model where every set has a bar weight. The first step is to say which movements are body-weight, on the Movements page. A movement also couldn't be changed once created, so a typo in a name, or a flag set the wrong way, stayed forever. Logging a body-weight set with the latest body weight is the second half.

**What changes for the user.**

- **The Body-weight checkbox.** The form to add a movement has a name, a muscle group select ("No muscle group" by default) and a Body-weight checkbox. A body-weight movement shows a "Body-weight" tag next to its name.
- **Editing a movement.** A pencil button on each row opens a dialog with the name, the muscle group and the Body-weight checkbox, saved together. A name the user already has, in any case, shows an error under the field and the dialog stays open. Changing only the case of the movement's own name ("bench press" to "Bench Press") is allowed. A movement can't be deleted.
- **Turning the flag on or off only affects the sets logged afterwards.** Old sets stay as they were logged (ADR 0003). The dialog says so.
- **A new name shows everywhere.** Sets read the name from their movement, so the Current Workout and the history show the new name, old workouts included. It is the same movement, so its sets, and later its Progression Chart, stay together.
- **The Movements page from the approved layout.** The muscle groups from "Planned and completed sets" get their screen here: each row has a select that changes the group in place, and a row of filters above the list shows All, each group in use and "No group", with a count each. On a narrow screen the row's controls wrap under the name, and fields, filters and buttons are 44 px tall on phones.

**How.**

- **Schema.** `Movement.isBodyWeight` is a boolean, false by default, so every existing movement stays a weighted one. The migration is one `ADD COLUMN`.
- **The flag travels with the movement.** `movementSelect` in `src/lib/movements/index.ts` now returns `isBodyWeight`, and the workouts module reuses that select, so every set already carries its movement's flag. The set form for body-weight movements needs exactly that.
- **One write for an edit.** `update(db, userId, movementId, { name?, isBodyWeight?, muscleGroup? })` changes whatever it is given and leaves the rest alone. The name is trimmed and `nameKey` is written with it (ADR 0001). `setMuscleGroup`, which the row's select uses, now calls `update`, so the select and the dialog share one write.
- **Check, then write, instead of catching P2002.** Renaming onto another movement's name breaks the unique `(userId, nameKey)` index, which Prisma throws as P2002. Catching it would abort a transaction the caller passed in as `db`, the same reason `create` and `start` avoid it (ADR 0006). Postgres has no `UPDATE ... ON CONFLICT`. So `update` first reads, in one query, the movement itself and any other of the user's movements with the new `nameKey`. No row for the id means `movement-not-found`, and another row means `movement-name-taken`. Only then does it write. Another user's movement gets the same `movement-not-found` as an id that doesn't exist. A double click is safe, because a movement never conflicts with itself. Two tabs renaming two different movements to the same name at the same moment can both pass the check, and the index refuses the second, which shows the generic error. The data stays right either way, and a take-home doesn't need more for a race that narrow.
- **Server function and mutation.** `updateMovementServerFn` validates the id as a UUID, the name with the shared `movementNameSchema`, and the group with `muscleGroupSchema`. `updateMovementMutationOptions` refreshes the movements and every workout, since sets show the name and workouts their groups (ADR 0011), and leaves `movement-name-taken` to the dialog through `formErrors`.
- **A dialog primitive.** `src/components/ui/dialog.tsx` is built on the native `<dialog>` element: `showModal()` keeps the focus inside, makes the page behind it inert, closes on Esc, and gives the focus back to the pencil button, all without a library. Its panel is a card over a slate scrim, as DESIGN.md allows, and the same look the empty-workout dialog will use. Its content mounts only while it is open, so the form starts from the movement as it is now, every time.
- **The screen.** `src/routes/__index/_layout.movements/index.tsx` only puts the pieces together; each one is in `-components/`: the new movement form, a row, the filter, the edit dialog, and the muscle group select and Body-weight checkbox they share. The filter's rules (`filterOptions`, `matchesFilter`) are plain functions with their own unit test. When the row's select changes, the select shows the new group while the mutation waits for the list to refetch, instead of jumping back for a moment. The group labels ("Lower Back") live once, next to the list of groups, in `src/lib/movements/muscle-group.ts`.

**Tests.** Integration: `create` with the flag; `update` renames, and the new name shows in the list and in the sets of the Current Workout; another of the user's movements' name in another case is refused and the list doesn't change; changing only the case of its own name passes; a name another user has passes; another user's movement gets the same `movement-not-found` as a random id and stays as it was; name, flag and group change at once; whatever isn't given stays; turning the flag off leaves every set of a Completed Workout and of the Current Workout as it was logged. Unit: the filter options and what each filter shows. E2E: a movement created as body-weight shows the tag after a reload; the dialog changes name, flag and group together, starts from the movement as it is and changes nothing on Cancel; a taken name shows in the dialog; the row's select saves the group; the filters list the groups in use with their counts and filter the list. The list checks read the name alone, since a row's text now also holds its select's options. Each guard was broken on purpose to watch its test fail: the owner check, the name check, a movement conflicting with its own name, the trim, `update` dropping the flag, the tag, the create form and the dialog dropping the flag, the dialog ignoring the current flag, a filter that shows everything, and a row select that doesn't save. The test that turning the flag off leaves sets alone had nothing to break yet, since no code reads the flag when logging; it starts guarding with the body-weight set form.

**Kept as it was, on purpose.** The body-weight set form, the Latest Body Weight as the set's weight, and Added Weight are the second half of assignment 2, in the next section. The phone layout of the whole app (the bottom tab bar) comes with the responsive layout work; until then the sidebar takes a phone's whole width on every page, this one included.

### Body-weight sets, added weight, and planned sets on screen (assignment 2, second half)

**The problem.** Assignment 2 asks that a body-weight movement's weight default to the latest body weight. A default the user can overwrite, though, lets yesterday's chart change whenever someone types a different number, and pull-ups with a weighted vest or with a band have no place to go. The Current Workout also had no screen yet for the planned sets from "Planned and completed sets".

**What changes for the user.**

- **The weight comes from the body weight.** For a body-weight movement, the Weight field shows the Latest Body Weight, read-only with a lock, and a note says where it comes from: "Pull-up uses your latest body weight: 172.4 lb from Nov 7, 2026." The server ignores whatever weight the form sends and copies the Latest Body Weight into the set itself (the Body Weight Snapshot, ADR 0003), so recording a new body weight later never changes a set already logged.
- **No body weight yet.** The field asks for it instead, under an amber notice. The weight typed in becomes the set's snapshot and today's body weight, in the same request, and the status line says so. The Profile shows the new entry.
- **Added Weight.** "+ Added weight" opens a row with Extra or Assistance, the amount and a required description. The sign comes from the two buttons, because a phone's number keypad has no minus key. The set reads "6 reps × 172.4 lb + 25 lb (weighted vest)", or "− 40 lb (resistance band)". Assistance can't be more than the body weight, so a Load is never negative.
- **Several sets at once, grouped by movement.** A "× sets" field adds up to ten identical sets, and the button reads "Add 3 sets". The list has one section per movement, in the order each first appears, with "2 of 3 completed" and a progress bar. The workout's muscle groups show under its date.
- **The circle unmarks a set.** Every set is added completed. The circle on each row unmarks one that wasn't done, which turns it into a Planned Set with a dashed outline, and marks it again. A planned body-weight set shows the Latest Body Weight of the moment, and takes a new snapshot when it is completed again.

**How.**

- **A flag on each set, fixed when it is logged.** `Set.isBodyWeight` copies the movement's flag when the set is added and never changes. When a set is completed again, the set's own flag decides whether it takes a new snapshot, never the movement's current one. A barbell set of 135 lb stays 135 lb after the movement is flagged body-weight, and a set logged as body-weight takes the new body weight after the flag is turned off. The alternative was to make `weight` nullable for planned sets, as ADR 0011 first described. That would have touched `load()`, every read and the history for the same result, so `weight` stays `NOT NULL`, and a planned set's stored weight is kept but never shown (ADR 0011 now says so).
- **`addedWeight` is signed, with its note in a column of its own.** `Decimal(6,2)`, positive for extra load and negative for assistance, so `load()` stays `weight + addedWeight` for every set (ADR 0003). `addedWeightNote` is `VARCHAR(60)`.
- **Three CHECKs behind the module.** The note goes with the added weight, Load is never negative, and only a body-weight set takes an added weight. They are the first CHECKs in the schema. The module refuses each case before writing, with `added-weight-not-allowed` or `assistance-exceeds-body-weight`, so a CHECK is a last line and never a 500. Completing a planned set again checks the assistance against the new snapshot, which can be lower than the one it was logged with.
- **One transaction, opened by the server function.** `addSetServerFn` runs `workouts.addSet(tx, …)` inside `db.$transaction`, so a first body weight and its sets are saved together or not at all. The module never opens a transaction of its own, because a caller may already have passed one and Prisma 7.2 can't nest them. Every refusal comes before the first write. A first body weight of 0 gets `body-weight-required`.
- **The screen.** `src/routes/__index/_layout.current-workout/index.tsx` puts the pieces together, and each one is in `-components/`: the form, the weight field, the added weight row, the list, the muscle groups. The form reads the Latest Body Weight from the same query as the Profile, so no server function was added. The refusals show under the form through `formErrors`, and adding a set refreshes the body weight queries, since the first body-weight set can record an entry.
- **Research first.** `docs/research/body-weight-sets-and-progression.md` compares how Hevy, Strong, Caliber and Fitbod handle weighted and assisted sets. None of them documents a snapshot; Caliber recomputes from the latest body weight, so its old charts move. That confirmed ADR 0003, and led to the re-check of the assistance on completion.

**Tests.** Integration: the snapshot is the Latest Body Weight by date, whatever the form sent, and a later entry doesn't move it; a movement that isn't body-weight keeps the weight sent; with no entry yet, the weight sent becomes the snapshot and today's entry in São Paulo at 22:00 (still the day before in UTC), a weight of 0 is refused and nothing is recorded; +25 lb and −20.5 lb give the right Load, assistance equal to the body weight gives a Load of 0, and anything above it is refused, also when checked against the body weight sent; added weight on a barbell movement is refused; a planned set shows the Latest Body Weight and its Load; completing it again takes a new snapshot, completing it twice changes nothing, and a new body weight below its assistance leaves it planned with `assistance-exceeds-body-weight`; both directions of turning the flag; deleting an entry leaves a body-weight set unchanged (now with a body-weight movement, so the test can fail). Migration: existing sets keep their weight with no flag and no added weight, and each CHECK refuses what it should. Unit: the draft takes added weight and its note together or not at all; the sets group by movement in order of first appearance. E2E: the locked weight and its note; the first body weight saved as today's, shown on the Profile; added weight only for body-weight movements, with its errors and assistance above the body weight refused; the set rows for extra and assistance; a planned set at the latest body weight next to a completed one at its own; "× 3", unmarking a set and marking it again, which keeps its place; the muscle groups under the date. Each new guard was broken on purpose to watch its test fail.

**Kept as it was, on purpose.** The history table still counts every set and its maximum still reads `weight`; both change with the Progression Chart, in the next pull request. The phone layout of the app shell is still the responsive layout work.

### Progression charts, and the history table counting completed sets (assignment 3)

**The problem.** Assignment 3: the Workout History should show how the lifter is progressing, with a chart where they pick a movement and a metric (Max Weight, Total Reps, Total Volume). The history table also still counted planned sets and read its maximum from `weight`, so a set with a weighted vest or a band showed the wrong number.

**What changes for the user.**

- **A Progression card** above Completed Workouts. On a wide screen, a list of the movements with a search box sits beside the chart; on a narrow one, the list becomes a search field that opens the matching movements. Typing filters the list and never changes the chart: only picking a movement does. Enter picks the first match.
- **One point per Training Day**, the date a workout was completed, in the lifter's time zone. Two workouts on the same day become one point, and its tooltip says "2 workouts combined".
- **Three metrics, all from Load** (`weight + addedWeight`): Max Weight is the day's highest Load, Total Reps the day's reps, Total Volume the day's Load × reps. Only Completed Sets count. An assisted pull-up with −20 lb counts as the body weight minus 20.
- **3M, 1Y or All**, All by default. The chart opens on the movement with the most Training Days, on Max Weight.
- **Gaps.** 15 days or more between two Training Days of the movement is shaded and named ("3 weeks without Bench Press"), and so is the time since the last one once it passes 15 days ("No Bench Press since Jun 3, 2026"). 14 days, one missed weekly session, is not a Gap. Setlist knows no training plan, so it states the fact and never says a session was missed. A period with no Training Days says when the last one was and offers "Show all time".
- **The history table counts Completed Sets.** The Sets column reads "4 of 5" when some were left planned, each movement's cell gives the heaviest Load and average reps of its completed sets with "2 of 3 sets", and a Muscle groups column follows the date.

**How.**

- **One query per movement, aggregated in Postgres (ADR 0004).** `getMetrics(db, userId, movementId, timeZone)` in `src/lib/progression/index.ts` returns every Training Day with its three metrics in one `$queryRaw`, so switching the metric or the period never goes back to the server (an e2e test counts the requests). A movement's history is at most hundreds of days, so the period is filtered in the browser; if it ever reaches thousands, the filter moves to the server.
- **The Training Day is computed once.** `("completedAt" AT TIME ZONE 'UTC' AT TIME ZONE $tz)::date`: the first `AT TIME ZONE` reads the stored UTC time, the second shows it in the lifter's zone. The zone is a bound parameter. Prisma numbers each `${timeZone}` apart, so repeating the expression in `GROUP BY` fails with 42803; the day is computed in a subquery and grouped there (`docs/research/body-weight-sets-and-progression.md` §7). A zone Postgres doesn't know comes back as `invalid-time-zone`, not a 500.
- **One Load formula, in two forms.** `load()` in `src/lib/weight.ts` stays the only formula in TypeScript; the SQL fragment beside the query is the same `weight + coalesce("addedWeight", 0)`, and an integration test checks both give the same number with no, positive and negative added weight.
- **The picker lists movements with a completed set.** `listMovements(db, userId, timeZone)` counts Training Days in the same zone, so its query key carries the zone, like the metrics' (`["progression", "movements", tz]`, `["progression", movementId, tz]`). The search filters that list in the browser: a personal library has dozens of movements.
- **Gaps are worked out in the browser.** `findGaps` in `src/lib/progression/gaps.ts` counts calendar days between the `"YYYY-MM-DD"` strings with `Date.UTC`, so a daylight-saving change never shifts it by one, and runs over all the Training Days before the period clips them, so a Gap that starts before the window shows from its first day.
- **One chart for the app.** The Progression Chart is the same `TimeChart` as the Body Weight Chart, which gained an optional start date, Gap bands (`ReferenceArea` with numeric ends and `ifOverflow="hidden"`, plus a dashed line across each Gap), a note in the tooltip, and a value axis that picks a round step for any range, so a Total Volume in the thousands gets a handful of ticks ("12.5k"). The Body Weight Chart looks as it did.
- **The screen.** `src/routes/__index/_layout.workout-history/index.tsx` puts the pieces together, each in `-components/`: the Progression card, its chart, the movement list and combobox, and the table with its row. The choices that need no React (the default movement, the search, the period start, the Gap labels, the table's counts) are plain functions with unit tests. The metric and period buttons use a new `SegmentedControl` primitive, the same one as Extra / Assistance on the set form.

**Tests.** Integration: a workout completed at 23:00 in São Paulo (02:00 UTC the next day) falls on the right day in each zone; two workouts on the same day give one point with reps and volume added up and `workouts: 2`; an assisted set counts as body weight minus the assistance; one completed and two planned sets count only the completed one; the SQL Load matches `load()`; another user's movement gets the same `movement-not-found` as a random id; an unknown zone gives `invalid-time-zone`; the picker lists only movements with a completed set, sorted by name, with Training Days counted in each zone. Unit: 14 days is no Gap and 15 is; an Open Gap; the Gap labels in weeks and months; the axis steps and the "k" labels; the default movement, the search and the period; the table's counts. E2E: a movement with a completed set is charted and one with only planned sets isn't listed; the search filters, keeps the chart, picks on Enter and says when nothing matches; switching to Total Reps and Total Volume sends no request; a clock moved months ahead shows the empty period, the last Training Day, "Show all time" and an Open Gap with its tooltip; the phone combobox; "2 of 3 sets" and the Muscle groups column in the history.

**Kept as it was, on purpose.** Completing a workout with no completed sets still completes it; the Gym Visit row and dialog are their own issue. The phone layout of the app shell is still the responsive layout work.

### Indexes on foreign keys

**The problem.** Postgres doesn't index a foreign key on its own, and neither does Prisma. The starter schema had none, so every read by workout or by user read the whole table: a user's Current Workout, the sets of a workout, the history. With a few thousand rows nobody notices. With millions, every screen slows down as the app grows, for every user. This answers the stretch goal "tell us what we're doing wrong".

**How.**

- **The indexes came with the change that touched each table**, each in its own migration: `Set(workoutId)` and `Set(movementId)` with the movement owners (`20261106120100_index_set_foreign_keys`, see "Movements owned by each user"), and `Workout(userId, completedAt)` with the one Current Workout per user (`20261107064038_workout_user_completed_index`). `Set(movementId)` is for the Progression Chart, which reads one movement's sets; no code reads it yet.
- **A unique index can cover a foreign key.** A B-tree is searched from its first column, like a phone book sorted by surname, then first name: it finds every Silva, not every João. So the unique `(userId, nameKey)` of `Movement` and `(userId, date)` of `BodyWeightEntry` already serve the lookups by `userId`, and neither table got a second index.
- **`(userId, completedAt)` serves the Current Workout and the history.** A user's workouts sit together in it, ordered by completion, and Postgres can search it for `completedAt IS NULL` too. The partial index of ADR 0006 is smaller and wins the Current Workout lookup, but it only holds Current Workouts, so it can't serve the history.
- **A test keeps it that way** (see Tests). A new table with a foreign key, such as sessions or login attempts, fails it until it gets an index.

**The proof.** `bun run db:explain-indexes` (`scripts/explain-foreign-key-indexes.ts`) fills a throwaway `setlist_explain` database with 2,000 users, 100,000 movements, 202,000 workouts and about 2 million sets, which takes a few minutes. It captures the SQL Prisma sends for the Current Workout, the history and deleting workouts, and runs `EXPLAIN ANALYZE` on it with the indexes and again after dropping them, inside a transaction that is rolled back. The Progression Chart query isn't in the code yet, so it uses the shape ADR 0004 describes. "Before" also drops ADR 0006's partial index, since the starter code had none of the four. One run:

| Query                                               | Before                                     | After                                                   |
| --------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| Current Workout: the workout                        | Seq Scan on `Workout`, 59 ms               | Index Scan on ADR 0006's partial index, 0.2 ms          |
| Current Workout without ADR 0006's index            | Seq Scan on `Workout`, 57 ms               | Index Scan on `Workout_userId_completedAt_idx`, 0.06 ms |
| Current Workout: its sets                           | Seq Scan on `Set`, 119 ms                  | Bitmap scan on `Set_workoutId_idx`, 0.2 ms              |
| History: the workouts                               | Seq Scan on `Workout`, 47 ms               | Bitmap scan on `Workout_userId_completedAt_idx`, 0.3 ms |
| History: their sets                                 | Seq Scan on `Set`, 147 ms                  | Bitmap scan on `Set_workoutId_idx`, 2.3 ms              |
| Progression Chart of one movement                   | Seq Scan on `Set`, 112 ms                  | Bitmap scan on `Set_movementId_idx`, 2.6 ms             |
| Deleting 5 workouts: their sets                     | Seq Scan on `Set`, 427 ms                  | Bitmap scan on `Set_workoutId_idx`, 0.2 ms              |
| Deleting 5 workouts: the foreign-key check on `Set` | 1,176 ms, a full read of `Set` per workout | 0.3 ms                                                  |

- **Read the shape, not the milliseconds.** The times change from run to run with whatever else the machine is doing. The scans don't.
- **A bitmap scan is an index scan too.** For one row Postgres follows the index straight to it (Index Scan). For more rows, spread over many pages, it first collects their addresses from the index, sorts them by page, then reads each page once.
- **Deleting is where it hurts most.** After deleting a workout, Postgres checks that no set still points to it. Without `Set(workoutId)`, that check reads every set, once per deleted workout.
- **An open finding, outside this change.** The history reads the movements of its sets by primary key, so no foreign key is involved, but Prisma sends one id per set: 1,000 ids for 50 movements. Postgres plans for 1,000 rows and reads all of `Movement` (100,000 rows, 11 ms) to return 50. It grows with the history, which loads every workout at once; a history that loads a page at a time would shrink it.

**Tests.** Migration (throwaway database at the schema right before the `Workout` index): the check finds `Workout(userId)` and nothing else, so the unique on `(userId, nameKey)` counts as cover; a partial index on `"Workout"("userId") WHERE "completedAt" IS NULL`, ADR 0006's shape, still leaves `Workout(userId)` uncovered; after the migration, nothing is left. Integration (`src/test/foreign-key-indexes.test.ts`): with every migration applied, no foreign key lacks an index. The partial-index rule was removed on purpose to watch its test fail.

**Kept as it was, on purpose.** An index costs disk space and makes every insert a little slower, so each one here answers a read the app does or, for `Set(movementId)`, the Progression Chart. The check counts any non-partial index whose leading columns are the key's. An index left invalid by a failed `CREATE INDEX CONCURRENTLY`, or a key column only in an `INCLUDE`, would fool it, but no migration here makes either, so the check doesn't test for them.

### Sessions in the database, and one account per email address

**The problem.** Hashing the passwords (assignment 5) protects them in the database, but the session cookie had its own weaknesses. It held the user ID and an HMAC of it, with no expiry inside, so a copied cookie worked forever, and "Log out" only deleted it from that browser: the copy kept working. The same address typed as `Lucas@x.com` and `lucas@x.com` made two accounts, and one pasted with a trailing space couldn't sign in. This answers the "Security" stretch goal on session management (ADR 0009).

**How.**

- **An auth module.** `src/lib/auth/index.ts` has four operations: `register`, `signIn`, `signOut` and `currentUser`, wrapped in `createServerOnlyFn` like the other domains (ADR 0010). They take the database and the session cookie as a seam, `{ get, set, delete }`: `src/lib/auth/session.server.ts` is the TanStack adapter, and the tests pass an in-memory cookie. `currentUser` returns only `{ id, email, name }`, so the password never leaves the module. `auth.functions.ts` keeps thin adapters with `toServerResult` and two new codes, `invalid-credentials` (the same for an unknown email and a wrong password) and `email-taken`. `authMiddleware` calls the module directly instead of another server function.
- **Sessions in a table.** Each sign-in creates a `Session` row. The cookie holds a random 32-byte token, and the table stores only its SHA-256 hash, so a copy of the table can't be used to sign in. A fast hash is enough here: unlike a password, there is nothing to guess in 32 random bytes. The cookie is `httpOnly` and `sameSite: "lax"`.
- **15 days, sliding.** When less than 14 days are left, reading the session pushes the expiry 15 days out and writes the cookie again, so the browser doesn't drop it on day 15 while the row is still valid. That is at most one write a day per browser, with no "last renewed" column. Sliding stops 90 days after sign-in: the expiry never passes that day and the cookie's max age is cut to match, so even someone who opens the app every day signs in again every 90 days, and a copied cookie can't be kept alive forever.
- **Signing out ends the session.** It deletes the row, so a copy of the cookie stops working too. Other browsers stay signed in. Expired sessions are deleted when they're read, and at sign-in for that user; there is no scheduled cleanup. `Session(userId)` is indexed in the same migration (see "Indexes on foreign keys").
- **Found in review, and fixed.** An unknown email answered before argon2 ran, so the response time told which addresses have an account: sign-in now verifies against a dummy argon2id hash when no account matches. Signing in again over a live session left the old row valid for 15 days: it is now deleted first. The cookie was `secure` only when `NODE_ENV` was `production`, which nothing here sets: it is now `secure` unless `ENVIRONMENT` is `development` or `test`, so a deploy that forgets the variable still sends it over https only. Passwords are capped at 256 characters and names at 100, so one request can't hand argon2 an unbounded input. Reading a session takes two small queries (the session, then its user); ADR 0009 now says so.
- **No more `COOKIE_SECRET`.** Nothing is signed anymore, so it left `.env`, the CI workflow and `AGENTS.md`. A variable that protects nothing would mislead whoever finds it.
- **One account per address.** Register and sign-in store and look up the address trimmed and in lower case (`src/lib/auth/email.ts`). A hand-written migration (`20261108060000_normalize_user_emails`) rewrites the stored addresses the same way. If two accounts differ only by case or surrounding whitespace, it refuses to run and lists their ids (not their addresses, which would land in the deploy log), instead of merging them: nobody verifies an address here, so "keep the oldest" could hand an account to someone else. Its whitespace and lower-case rules are the SQL ones of the movements migration, which match JavaScript's `trim()` and `toLowerCase()`, and a test runs them against the code. On the development database: 6,815 users, no collision, no address to rewrite.

**Tests.** Integration (`src/lib/auth/auth.test.ts`, with a controlled clock): register, `currentUser`, sign out, then `currentUser` is null; a copy of the cookie stops working after sign-out; a sign-in on a second browser keeps the first session, and signing in again on the same browser ends its old one; on day 2 the session is renewed and the cookie written again, half a day in it isn't; a session used every day still ends 90 days after sign-in, and a renewal on day 80 lasts the 10 days left, in the row and in the cookie; an expired session is null and its row is gone; sign-in deletes the user's expired sessions; a cookie in the old signed format is refused; the session never shows the password; `Lucas@...` and ` lucas@... ` are one account. Unit: the cookie attributes per environment, the input length limits, and the dummy-hash check for an unknown email. Unit and SQL (`src/lib/auth/email.test.ts`): the migration's functions give the same address as `normalizeEmail` for tabs, no-break and ideographic spaces, a BOM, a final sigma and a Turkish İ. Migration (`src/test/migrations/normalize-user-emails.test.ts`): addresses are rewritten, and a collision aborts the migration, names every colliding account by id without any address, and changes nothing. Each rule was broken by hand once to watch its test fail. E2E: a copied session cookie stops working after "Log out".

**Kept as it was, on purpose.** Everyone signed in when this ships signs in once more: the cookie format changed, and there is no compatibility path (same reasoning as ADR 0005). "Sign out everywhere" and ending all sessions on a password change are one `deleteMany({ where: { userId } })` away, and wait for a screen. `email-taken` still tells a visitor that an address has an account; limiting sign-in attempts is the next change.

### Completing an empty workout: save it as a gym visit, or discard it

**The problem.** Completing a workout with no sets put it in the history as "0 sets", without asking. Sometimes a lifter goes to the gym and leaves without training, and that can be worth a record, but the choice should be theirs. Since sets can be left planned (ADR 0011), "empty" also covers a workout whose sets were all unmarked. This is part of the "UI polish" stretch goal: the app asks instead of guessing. The evidence for asking, rather than blocking as Hevy and StrongLifts do, is in `docs/research/empty-workouts.md`.

**How.**

- **The module asks first.** `complete(db, userId, { whenEmpty })` in `src/lib/workouts/index.ts` returns `empty-workout` when the workout has no Completed Set and no choice was sent, and the workout stays current. `"save"` completes it as a **Gym Visit** (`CONTEXT.md`), Planned Sets and all. `"discard"` deletes it with its Sets, and only while it has no Completed Set: `complete` reads the workout once, refuses with `workout-not-empty` if a set is done, and only then deletes. Discarding is a branch of `complete`, not an operation of its own, so no path can delete a workout with sets done. A workout with a Completed Set completes as before. The server function runs it in one `RepeatableRead` transaction, so both deletes work from the snapshot that found the workout empty: if another tab completes or adds a set in between, Postgres refuses the whole transaction and nothing is lost (the page shows the generic error).
- **The page asks in a dialog.** `empty-workout` is listed in the mutation's `formErrors`, so it gets no error toast: the Current Workout page opens a dialog instead (the approved prototype), with three equal choices, Save as gym visit, Discard workout and Keep logging. No button is filled, and the focus opens on the title, so a stray Enter does nothing. Esc or a click outside means keep logging, and the focus goes back to the movement picker. When the server refuses (another tab changed the workout), the mutation refetches the Current Workout before it settles, so the dialog opens on the workout as it is now (the error toast, shown by the global `MutationCache` handler, appears right away). A status line then says what happened ("Saved as a gym visit. View in history", "Workout discarded."). The `Dialog` primitive gained an initial-focus option, and `Button` a `destructive-outline` variant, recorded in `DESIGN.md`.
- **The history says so.** A Gym Visit reads "Gym visit, no sets logged", or "Gym visit, 0 of N sets completed" when it kept Planned Sets, across the set count and movement columns, with "-" for Muscle groups. It is deleted like any workout. Progression Charts don't change: they only count Completed Sets.
- **Deleting only touches the history.** `deleteWorkouts` used to delete any workout of the user, so the Current Workout's id, sent straight to the server function, deleted it with its Sets. It now only deletes Completed Workouts.

**Tests.** Integration: an empty workout and one with only Planned Sets both return `empty-workout`; a set completed or added by another tab during a discard rolls it back, with every set kept (two database clients) and stay current; save puts it in the history with its Planned Sets not completed; discard leaves no workout and no sets; discard on a workout with a Completed Set returns `workout-not-empty` and deletes nothing; a workout with a Completed Set completes without a choice; `deleteWorkouts` with the Current Workout's id deletes nothing. Unit: the Gym Visit labels and the history columns. E2E (`e2e/gym-visit.spec.ts`): the dialog opens with the focus on its title and no toast; each of the three choices; Esc and a click outside; the planned-sets wording, singular and plural; a second tab that adds or completes a set before the choice; both history labels; deleting a Gym Visit. The focus, the return focus and the no-toast rule were each broken by hand once to watch their test fail.

### Workout History loads 20 workouts at a time

**The problem.** The history read every Completed Workout of the user, with every Set and Movement, on each visit. Someone training four times a week adds about 200 workouts and 4,000 sets a year, so the page and its query grow without a ceiling. "Indexes on foreign keys" above already noted one symptom: Prisma sends one movement id per loaded set. This answers the "Data model and performance" stretch goal.

**How.**

- **A page at a time, by cursor.** `history(db, userId, { cursor, limit = 20 })` in `src/lib/workouts/index.ts` returns `{ workouts, nextCursor }`, most recently completed first. The cursor is `(completedAt, id)`: workouts completed in the same millisecond are ordered by id, so a page boundary never skips or repeats one. It reads `limit + 1` rows to know whether another page exists. With a cursor, the query also bounds `completedAt <= cursor` at the top level, so Postgres seeks the `Workout(userId, completedAt)` index straight to the cursor instead of walking down from the newest workout. The page size (20, at most 50) and the cursor's shape live in one client-safe file, `src/lib/workouts/history-page.ts`, which the module, the server function, the query and the route all import; the module also clamps the limit itself.
- **Load more.** The screen uses `useSuspenseInfiniteQuery`, and the route loader prefetches the first page with `ensureInfiniteQueryData`. A Load more button at the end of the list fetches the next page and disappears after the last one; the keyboard focus then moves to the first new row instead of falling to the page. If a page fails to load, a message says so and the button retries. The movement columns are computed over every workout loaded so far.
- **Selecting and deleting.** "Select all" marks only the loaded workouts, and its label says so ("Select all loaded workouts"): it never deletes a workout the lifter hasn't seen. Deleting or completing a workout refetches every loaded page in order from the first, under the same `workoutKeys.history` prefix as before, so nothing is skipped or shown twice.
- **Why a cursor and not an offset.** Deleting a workout while paging shifts every later offset by one, so `OFFSET 20` would skip a workout; and Postgres still reads and discards every skipped row. A cursor names the last row seen, so it stays correct and reads only the next page.
- **A small page for the tests.** A hidden `?pageSize=` search parameter (1 to 50) lets the e2e page through three workouts instead of creating 21, which takes minutes through the UI.

**Tests.** Integration: 25 workouts come back as 20 and 5, with no cursor after the last page; a page that is exactly full has no cursor; five workouts completed in one millisecond page in id order, nothing skipped or repeated; another user's workouts and the Current Workout never appear; a Gym Visit pages like any workout; a limit below 1 reads as 1 and one above 50 as 50. E2E (`e2e/load-more.spec.ts`): one page, then the rest, and the button goes away; no button when everything fits; workouts selected on both pages are deleted together; "Select all" marks only what is loaded; the focus moves to the first new row; a failed page shows a message and the button retries.
