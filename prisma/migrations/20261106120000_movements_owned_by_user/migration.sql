-- Every Movement gets an owner (ADR 0001). Written by hand: existing movements have no owner to
-- give them, so a plain NOT NULL column can't be added. Postgres runs this file as one implicit
-- transaction, so it either applies whole or not at all.
--
-- 1. Each user who logged Sets with a movement gets a copy of it, and their Sets move to the copy.
-- 2. Case-duplicates of one user ("Bench Press", "bench press") become one movement: the one with
--    the most of that user's Sets survives (ties: the lowest id), and it takes the others' Sets.
-- 3. The shared movements, and the ones nobody used, are deleted. No Set is lost.
--
-- nameKey must match movementNameKey() in src/lib/movements/name.ts: the name without leading or
-- trailing whitespace, lower-cased.
-- - Trim: SQL trim() only strips " ", and the regexp \s misses the no-break spaces but strips
--   U+0085, which JavaScript keeps. So the class spells out exactly what JavaScript's trim()
--   strips: WhiteSpace and LineTerminator in the ECMAScript spec.
-- - Lower case: lower() follows the database collation (libc), which differs from JavaScript's
--   toLowerCase() on letters such as a final "Σ" or a Turkish "İ". ICU applies the Unicode rules,
--   as JavaScript does.
-- src/lib/movements/name.test.ts runs these two functions from this file against the code.

CREATE FUNCTION pg_temp.trim_whitespace(value TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(value, '^[ \t\n\v\f\r\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[ \t\n\v\f\r\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$', '', 'g')
$$;

CREATE FUNCTION pg_temp.name_key(value TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(pg_temp.trim_whitespace(value) COLLATE "und-x-icu")
$$;

-- New columns, nullable until every row has an owner.
ALTER TABLE "Movement"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "nameKey" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Which movements each user logged Sets with, and how many.
CREATE TEMP TABLE "movement_usage" AS
SELECT w."userId",
       s."movementId",
       pg_temp.name_key(m."name") AS "nameKey",
       count(*) AS "setCount"
FROM "Set" s
JOIN "Workout" w ON w."id" = s."workoutId"
JOIN "Movement" m ON m."id" = s."movementId"
GROUP BY w."userId", s."movementId", m."name";

-- One survivor per user and name key, and the id of the user's copy of it.
CREATE TEMP TABLE "movement_survivor" AS
SELECT DISTINCT ON ("userId", "nameKey")
       "userId",
       "nameKey",
       "movementId" AS "survivorId",
       gen_random_uuid()::text AS "copyId"
FROM "movement_usage"
ORDER BY "userId", "nameKey", "setCount" DESC, "movementId";

-- The user's own copy, named like the survivor (without the surrounding whitespace).
INSERT INTO "Movement" ("id", "userId", "name", "nameKey")
SELECT sv."copyId", sv."userId", pg_temp.trim_whitespace(m."name"), sv."nameKey"
FROM "movement_survivor" sv
JOIN "Movement" m ON m."id" = sv."survivorId";

-- Every Set moves to its owner's copy, case-duplicates included.
UPDATE "Set" s
SET "movementId" = sv."copyId"
FROM "Workout" w, "movement_usage" u, "movement_survivor" sv
WHERE w."id" = s."workoutId"
  AND u."userId" = w."userId"
  AND u."movementId" = s."movementId"
  AND sv."userId" = u."userId"
  AND sv."nameKey" = u."nameKey";

-- Only the shared movements are left without an owner, and no Set points at them anymore.
DELETE FROM "Movement" WHERE "userId" IS NULL;

DROP TABLE "movement_usage", "movement_survivor";
DROP FUNCTION pg_temp.name_key, pg_temp.trim_whitespace;

-- AlterTable
ALTER TABLE "Movement"
  ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "nameKey" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Movement_userId_nameKey_key" ON "Movement"("userId", "nameKey");

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
