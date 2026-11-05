# One Current Workout per user, enforced by a partial unique index

The UI shows a single Current Workout, but nothing stopped a user from having several: `createWorkoutServerFn` didn't check, and `getCurrentWorkoutServerFn` picked one by ordering on a random UUID. A partial unique index on `"Workout"("userId") WHERE "completedAt" IS NULL` now guarantees at most one, and starting a workout while one exists returns the existing one. Prisma 7.2 can't express partial indexes in `schema.prisma`, so the index exists only in a hand-written migration.

## Consequences

The index can't be created while any user has more than one open workout, and existing rows don't record when they started. Before creating the index, the migration deletes empty open workouts, keeps the open workout with the most sets for each user, and marks the others as completed now. No set is lost.

Prisma doesn't know the index exists, so every new migration that `prisma migrate dev` generates will include a `DROP INDEX` for it. Delete that line before applying the migration.

## Considered Options

- **Check in the server function only.** Simpler, but two concurrent requests (a double click) can both pass the check.
