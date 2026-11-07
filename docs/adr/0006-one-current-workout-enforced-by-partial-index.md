# One Current Workout per user, enforced by a partial unique index

The UI shows a single Current Workout, but nothing stopped a user from having several: `createWorkoutServerFn` didn't check, and `getCurrentWorkoutServerFn` picked one by ordering on a random UUID. A partial unique index on `"Workout"("userId") WHERE "completedAt" IS NULL` now guarantees at most one, and starting a workout while one exists returns the existing one. Prisma 7.2 can't express partial indexes in `schema.prisma`, so the index exists only in a hand-written migration.

## Consequences

The index can't be created while any user has more than one Current Workout, and existing rows don't record when they started. Before creating the index, the migration sorts out only the users with more than one: it keeps open the one with the most Sets (ties: the lowest id), deletes the other empty ones, and marks the others with Sets as completed now. No Set is lost. A user with a single Current Workout keeps it, even an empty one: completing or discarding a workout with no Sets is the user's choice (CONTEXT.md, Gym Visit), and a migration that deletes it silently would make that choice for them. Legacy Sets carry no timestamp, so there is no truer completion time to use: each affected user gets one extra Training Day, on the day of the migration, in their Progression Charts. That's rare and accepted.

Starting a workout uses `INSERT ... ON CONFLICT ("userId") WHERE "completedAt" IS NULL DO NOTHING` and then reads the Current Workout. Catching P2002 and reading again would also work alone, but not inside a `$transaction`, because Postgres aborts the transaction after the error.

Prisma doesn't introspect the partial index, so it neither manages it nor drops it: the migrations `prisma migrate dev` generates leave it alone (checked with Prisma 7.2 by generating one against a copy of the migrations). The rule is still written in three places, the Prisma `where` of the workouts module, the `ON CONFLICT` of `start()`, and the index, so a change to what a Current Workout is has to touch all three. An integration test runs concurrent `start()` calls, each through its own client, and guards the index: the test setup runs `migrate deploy`, and without the index the `ON CONFLICT` has no constraint to match, so the test turns red.

## Considered Options

- **Check in the server function only.** Simpler, but two concurrent requests (a double click) can both pass the check.
- **Delete every empty Current Workout in the migration.** The first plan. The index doesn't need it, and on the local database it would have deleted 471 workouts, each the only Current Workout of its user, without asking.
