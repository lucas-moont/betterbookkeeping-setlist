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
├── routes/        # File-based routes; each page keeps its queries in a -queries/ folder
├── components/    # Shared UI components
└── lib/           # Server functions, auth, and database access
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
- **Safe with a shared movement library.** Every user still sees every movement (ADR 0001 changes that), and parallel tests keep adding to the list. Each test gives its movements a random suffix and checks that the list contains them, never that it equals them.
- **Accessible names.** The movement name input, the set form fields, the icon-only "Remove set" button and the history checkboxes had no accessible name, so screen readers announced them as unnamed controls. They now have `aria-label`s, which is also how the tests find them. Nothing changes visually.
- **Each test was seen failing.** For behavior that already worked, each group of tests was run against a temporarily broken app (for example, the movement list sorted backwards, or a server that skips deleting the set) to prove the tests catch the bug. Pull request #13 lists every one.
