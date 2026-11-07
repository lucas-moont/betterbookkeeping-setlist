-- When a Workout started. Workouts that already exist have no record of it, so theirs stays NULL,
-- which the code reads as "unknown" (ADR 0007). Every new Workout gets one.
ALTER TABLE "Workout" ADD COLUMN "startedAt" TIMESTAMP(3);

-- A user has at most one Current Workout (ADR 0006). The index below can't be created while a user
-- has more than one, so only those users are sorted out here; a user with one Current Workout keeps
-- it, even an empty one, because completing or discarding it is the user's choice (CONTEXT.md, Gym
-- Visit). Each user keeps open the one with the most Sets (ties: the lowest id).

-- 1. The extra Current Workouts with no Set hold nothing, so they are deleted.
WITH ranked AS (
  SELECT w.id,
         ROW_NUMBER() OVER (
           PARTITION BY w."userId"
           ORDER BY (SELECT count(*) FROM "Set" AS s WHERE s."workoutId" = w.id) DESC, w.id
         ) AS keep_order
  FROM "Workout" AS w
  WHERE w."completedAt" IS NULL
)
DELETE FROM "Workout" AS w
USING ranked
WHERE w.id = ranked.id
  AND ranked.keep_order > 1
  AND NOT EXISTS (SELECT 1 FROM "Set" AS s WHERE s."workoutId" = w.id);

-- 2. The extra ones that have Sets are completed now, so no Set is lost. Legacy Sets carry no
-- better time, so these users get one more Training Day, on the day of the migration (ADR 0006).
-- The one kept above is still first in this order: step 1 only deleted Workouts ranked after it.
-- The column has no time zone and Prisma reads it as UTC, so the time is written in UTC whatever
-- the session's TimeZone is.
WITH ranked AS (
  SELECT w.id,
         ROW_NUMBER() OVER (
           PARTITION BY w."userId"
           ORDER BY (SELECT count(*) FROM "Set" AS s WHERE s."workoutId" = w.id) DESC, w.id
         ) AS keep_order
  FROM "Workout" AS w
  WHERE w."completedAt" IS NULL
)
UPDATE "Workout" AS w
SET "completedAt" = now() AT TIME ZONE 'UTC'
FROM ranked
WHERE w.id = ranked.id
  AND ranked.keep_order > 1;

-- Prisma 7.2 can't express a partial index in schema.prisma, so it only exists here. Prisma doesn't
-- see it either, so the migrations `prisma migrate dev` generates leave it alone (checked with 7.2).
-- An integration test of start() turns red if a later migration ever drops it (ADR 0006).
CREATE UNIQUE INDEX "Workout_one_current_per_user" ON "Workout"("userId") WHERE "completedAt" IS NULL;
