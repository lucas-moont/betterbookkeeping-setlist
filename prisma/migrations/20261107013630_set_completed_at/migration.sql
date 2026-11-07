-- A Set is a Planned Set while completedAt is NULL, and a Completed Set once it holds when it was
-- completed (ADR 0011).
ALTER TABLE "Set" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Every existing Set was logged after it was done, so none becomes planned. A Set of a Completed
-- Workout takes the Workout's completedAt; one of a Workout still open takes the migration time.
UPDATE "Set" AS s
SET "completedAt" = COALESCE(w."completedAt", CURRENT_TIMESTAMP)
FROM "Workout" AS w
WHERE w.id = s."workoutId";
