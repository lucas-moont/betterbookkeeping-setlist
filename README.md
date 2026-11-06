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

| Script                     | What it does                                            |
| -------------------------- | ------------------------------------------------------- |
| `bun run dev`              | Start Postgres and the app in Docker with watch mode    |
| `bun run dev:down`         | Stop the Docker services                                |
| `bun run db:migrate`       | Create and apply a Prisma migration                     |
| `bun run db:reset`         | Drop the database and re-apply all migrations           |
| `bun run db:prepare`       | Apply pending migrations and hash legacy passwords      |
| `bun run typecheck`        | Type-check the project                                  |
| `bun run build`            | Build for production                                    |
| `bun run test`             | Run the Playwright e2e tests                            |
| `bun run test:ui`          | Run the e2e tests in Playwright's UI mode               |
| `bun run test:integration` | Run the Vitest integration tests against `setlist_test` |
| `bun run format`           | Format the code with Prettier                           |

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
├── components/    # Shared UI components
└── lib/
    ├── <domain>/  # One folder per concept (auth, movements, workouts, progression), with
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

The skipped cases in `e2e/movements.spec.ts`, `e2e/sets.spec.ts` and `e2e/workouts.spec.ts` now run, apart from two that wait for data the app doesn't store yet:

- "should show sets in the order they were added" needs a creation time on each set. Today sets have no defined order.
- "should show the workout date after starting" needs the workout's start time. Today the card shows today's date, so the test would pass without proving anything.

Both stay skipped and turn on once those timestamps exist (ADR 0007).

How the suite is built, and why:

- **One user per test.** `e2e/fixtures.ts` signs every test in as a new user, the same rule as the integration tests (ADR 0008). Tests own their data, so they can run in parallel.
- **Setup through the UI.** `e2e/helpers.ts` creates movements, starts and completes workouts, and adds sets by clicking through the app, the way a user would.
- **Exact lists.** Each test signs in as a new user, and since ADR 0001 a user only sees their own movements, so a test can check that the list equals its movements. Before, every user shared one library and parallel tests kept adding to it, so a test could only check that the list contained its movements.
- **Accessible names.** The movement name input, the set form fields, the icon-only "Remove set" button and the history checkboxes had no accessible name, so screen readers announced them as unnamed controls. They now have `aria-label`s, which is also how the tests find them. Nothing changes visually.
- **Each test was seen failing.** For behavior that already worked, each group of tests was run against a temporarily broken app (for example, the movement list sorted backwards, or a server that skips deleting the set) to prove the tests catch the bug. Pull request #13 lists every one.
- **Technical debt: a warm-up before the suite.** Right after the dev server starts, a few parallel sign-ups used to fail with "action is not a function". The cause is in Vite 7's SSR module runner: when two requests load the same module at once, the second one can get its exports before they are filled in ([vitejs/vite#22369](https://github.com/vitejs/vite/pull/22369)). The fix shipped in Vite 8.0.12 and was not backported to 7.x ([Vite 7 changelog](https://github.com/vitejs/vite/blob/v7/packages/vite/CHANGELOG.md)). The proper fix is to upgrade to Vite 8.0.12 or later. That is a major upgrade (Vite 8 bundles with Rolldown, and TanStack Start and Nitro may need to move with it), so for the delivery deadline `e2e/global-setup.ts` signs up once and opens every signed-in page before the workers start, which loads each module one request at a time. The production build the CI tests against is not affected. After the upgrade, delete `e2e/global-setup.ts` and `globalSetup` in `playwright.config.ts`.

### Code organized by domain, and cache invalidation declared on each mutation

Before, each page decided on its own what to refresh after a change: every `onSuccess` called `invalidateQueries` with a hand-typed key, and `movementsQueryOptions` was copied into two route folders. The upcoming features make one change affect several screens (completing a workout changes the history and the progression charts), so that rule now lives in one place (ADR 0010).

- **One folder per concept.** `src/lib/auth`, `movements`, `workouts` and `progression` hold the server functions (`<domain>.functions.ts`) and the TanStack Query side (`queries.ts`), whichever each one needs today: `auth/` has no queries, and `progression/` only has its key root until the charts exist. The route `-queries/` folders are gone. Code that must never reach the browser keeps the `.server.ts` suffix and is used only inside server-function handlers: the session cookie signing moved to `src/lib/auth/session.server.ts`, and a production build was checked to leave `COOKIE_SECRET` out of the client bundle.
- **Keys form a tree.** `["workouts", "current"]` and `["workouts", "history"]` share the `["workouts"]` root, so a mutation can refresh both with one prefix.
- **Each mutation says what it makes stale.** For example, `completeWorkoutMutationOptions` declares `invalidates: [workoutKeys.all, progressionKeys.all]` (through `serverMutationOptions`, which stores it in `meta.invalidates`). One `MutationCache` `onSuccess` in `src/router.tsx` reads that list. Pages only keep their own form resets, such as clearing the reps field.
- **A mutation stays pending until the screen shows the new data.** The global `onSuccess` returns the invalidation promise, as the TanStack Start guide's example does. Before, "Adding..." turned back into "Add", and the reps field was cleared, while the new set was still missing for one round trip. Now the label, the cleared field and the new row change together. Only the queries on screen refetch, so invalidating the history from the workout page costs nothing, and a failed refetch never turns a saved set into an error. The reasoning and sources are in `docs/research/mutation-invalidation-and-auth-flows.md`.
- **Sign-in, sign-up and logout stay plain server-function calls.** The signed-in user lives in the router context, not in the query cache, so a mutation would have nothing to invalidate. The official Start auth examples call the function directly, too. Logout stays a full page load, which also throws away the previous user's cached data.

Completing a workout now also invalidates the history. Since queries refetch whenever a page mounts, this changes nothing you can see today. It matters once some data is cached for longer.

### Workout rules in one module, tested against a real Postgres

Each workout server function used to do everything itself: validate the input, run one Prisma call, and work out on its own which workout was the user's open one. That rule was written four times, and the only tests were the e2e suite. The next features (one open workout per user, the empty-workout prompt, body-weight Sets) all add rules in exactly that spot. So the rules moved first, in a refactor that changes no behavior (ADR 0010).

- **One module.** `src/lib/workouts/index.ts` has seven operations: `start`, `get`, `addSet`, `removeSet` and `complete` for the Current Workout, plus `history` and `deleteWorkouts`. Each one takes `(db, userId, ...)`, so a caller can pass a transaction, and each one only touches that user's rows. The server functions keep their names and become thin adapters: auth, zod validation, the module call, and the error translation. The routes didn't change.
- **One definition of "Current Workout".** `currentWorkoutWhere(userId)` is the only place that says "this user's workout with no completion time". Before, `get` sorted the open workouts and `addSet` and `complete` didn't, so a user with two open workouts could add a Set to the one the screen wasn't showing. Now all three pick the same one. Only one open workout per user arrives later with a partial index (ADR 0006).
- **Errors as values.** Expected failures (`no-current-workout`, `set-not-found`) come back as `{ ok: false, reason }`. Their messages live in `src/lib/error-codes.ts`, and `toServerResult` turns them into the `{ success, code, error }` that reaches the browser. Removing a Set of a Completed Workout, or of another user, returns the same `set-not-found` as an id that doesn't exist, so the answer never reveals which ids are taken. Database errors still throw. An unknown movement used to be one of them; since movements have an owner, `addSet` returns `movement-not-found` instead (see below).
- **Less data to the browser.** The module selects only the columns the screens use, so `userId` and the foreign-key ids no longer leave the server. Sets also carry their `load`, computed by `load()` in `src/lib/weight.ts`, the one Load formula. The screens still show `weight`, which is the same number until body-weight Sets exist.
- **Integration tests through the module.** `src/lib/workouts/workouts.test.ts` runs every operation against the `setlist_test` database, one new user per test, and checks outcomes through `get` and `history`, never by reading tables. The cases come from `docs/research/current-workout-test-scenarios.md`: every authorization test uses two users, and every invalid action, such as completing twice or removing a Set of a Completed Workout, checks both the error and that nothing changed. As in #13, each guard was broken by hand once to watch its test go red. One of those runs found a gap: no test failed when `addSet` wrote into a completed workout, so a test for it was added.
- **Kept as it was, on purpose.** `start` still creates a workout every time, `complete` still finds and then updates, and `deleteWorkouts` still runs two statements without a transaction, because Prisma 7.2 can't nest one inside a caller's transaction. `deleteWorkouts` also accepts a Current Workout's id if one is sent straight to the server function. The screen never sends one, and the empty-workout flow will restrict it to Completed Workouts.
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
- **The movements module** (`src/lib/movements/index.ts`, ADR 0010) has `create`, `list` and `ensureOwned`, each taking `(db, userId, ...)`. `create` uses `INSERT ... ON CONFLICT DO NOTHING`, so a double click adds one row, and nothing throws inside a transaction the caller passed in (the reason ADR 0006 avoids catching P2002). `list` selects only `id` and `name`, so `userId` and `nameKey` never reach the browser. Editing a movement arrives with the body-weight flag, which also needs to keep `nameKey` in sync.
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
- **The cookie is untrusted input.** A bad value can't break a page: the zone is checked by trying it in `Intl` (not against `Intl.supportedValuesOf`, which leaves out "UTC" and "Asia/Kolkata"), its length is capped, offsets such as "+05:30" are refused (Postgres reads them with the sign flipped, which would move Training Days), and anything invalid falls back to UTC.

**Tests.** Unit: 01:00 UTC is Nov 6 in São Paulo and Nov 7 in UTC; today in São Paulo at 22:00 is "2026-11-06"; "2026-11-06" stays Nov 6 under São Paulo and Kiritimati process zones; `formatWeight` rounds `150.1 + 2.2` to "152.3 lb"; bad cookies such as "Mars/Olympus" or broken percent-encoding fall back to UTC. E2E, in two browsers set to Pacific/Kiritimati (UTC+14) and Etc/GMT+12 (UTC-12), which are never on the same date: the Current Workout title and the history date match the browser's day, the server's HTML has the same text, and React reports no hydration error. A first visit without the cookie renders UTC and then corrects itself. Formatting the title with the server's zone, ignoring the cookie on the server, or dropping the re-render each turned a test red.

**Kept as it was, on purpose.** The interface stays in English, with the locale written once in `src/lib/format.ts`; translating it (for example with `use-intl`) is out of scope. The history's per-movement maximum still reads `weight`; it switches to Load with body-weight sets.
