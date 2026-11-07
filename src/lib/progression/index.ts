import { createServerOnlyFn } from "@tanstack/react-start";
import { Prisma } from "../../../prisma/generated/client/client";
import type { DbClient } from "@/lib/db.server";
import type { Result } from "@/lib/error-codes";
import { ensureOwned } from "@/lib/movements";
// Only for the reader: loadSql below is the same formula, so the two must change together.
import type { load } from "@/lib/weight";

// The progression module (ADR 0010): the Metrics behind the Progression Charts, one point per
// Training Day, computed in SQL (ADR 0004). Every operation takes (db, userId, ...) and only ever
// reads that user's rows. Dates go out as "YYYY-MM-DD" text, never as a Date.

/** One point of a Progression Chart: a Training Day's Metrics for one Movement. */
export type TrainingDayMetrics = {
  date: string;
  maxWeight: number;
  totalReps: number;
  totalVolume: number;
  /** How many Completed Workouts that day had the Movement; more than one means they were combined. */
  workouts: number;
};

/** A Movement the Progression Chart can show, with how many Training Days it has. */
export type ProgressionMovement = { id: string; name: string; isBodyWeight: boolean; trainingDays: number };

/**
 * A Workout's Training Day: the date it was completed, in the user's zone. completedAt is
 * timestamp(3) holding UTC, so the first AT TIME ZONE reads it as UTC and the second shows that
 * instant in the zone (docs/research/body-weight-sets-and-progression.md §7).
 */
const trainingDaySql = (timeZone: string) =>
  Prisma.sql`(w."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timeZone})::date`;

/**
 * A Set's Load in SQL: the same formula as {@link load} in src/lib/weight.ts (ADR 0003). Both
 * columns are numeric(6,2), so the sum is exact and needs no rounding to match load().
 */
const loadSql = Prisma.sql`s.weight + coalesce(s."addedWeight", 0)`;

/**
 * The Movement's Metrics per Training Day, oldest first. A Training Day is the date the Workout was
 * completed, in the user's time zone; only Completed Sets of Completed Workouts count (ADR 0004,
 * ADR 0011). A Movement of another user gets the same movement-not-found as one that doesn't exist
 * (ADR 0001). A zone Postgres doesn't know gets invalid-time-zone.
 */
export const getMetrics = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    movementId: string,
    timeZone: string,
  ): Promise<Result<{ days: TrainingDayMetrics[] }, "movement-not-found" | "invalid-time-zone">> => {
    const owned = await ensureOwned(db, userId, movementId);
    if (!owned.ok) return owned;

    // The day is computed once, in the subquery: Prisma numbers each ${timeZone} apart, so repeating
    // it in GROUP BY would fail with 42803 (docs/research/body-weight-sets-and-progression.md §7).
    return inKnownTimeZone(async () => ({
      days: await db.$queryRaw<TrainingDayMetrics[]>`
        SELECT to_char(day, 'YYYY-MM-DD') AS date,
               max(load)::float8 AS "maxWeight",
               sum(reps)::int AS "totalReps",
               sum(load * reps)::float8 AS "totalVolume",
               count(DISTINCT "workoutId")::int AS workouts
        FROM (
          SELECT ${trainingDaySql(timeZone)} AS day,
                 ${loadSql} AS load, s.reps, s."workoutId"
          FROM "Set" s
          JOIN "Workout" w ON w.id = s."workoutId"
          WHERE w."userId" = ${userId} AND s."movementId" = ${movementId}
            AND w."completedAt" IS NOT NULL AND s."completedAt" IS NOT NULL
        ) AS completed_sets
        GROUP BY day
        ORDER BY day`,
    }));
  },
);

/**
 * The user's Movements that have a Progression Chart to show: those with at least one Completed Set
 * in a Completed Workout, sorted by name ignoring case. trainingDays counts the dates in the user's
 * zone, so the screen can open on the Movement trained most often.
 */
export const listMovements = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    timeZone: string,
  ): Promise<Result<{ movements: ProgressionMovement[] }, "invalid-time-zone">> => {
    return inKnownTimeZone(async () => ({
      movements: await db.$queryRaw<ProgressionMovement[]>`
        SELECT m.id, m.name, m."isBodyWeight", count(DISTINCT ${trainingDaySql(timeZone)})::int AS "trainingDays"
        FROM "Movement" m
        JOIN "Set" s ON s."movementId" = m.id
        JOIN "Workout" w ON w.id = s."workoutId"
        WHERE m."userId" = ${userId} AND w."userId" = ${userId}
          AND w."completedAt" IS NOT NULL AND s."completedAt" IS NOT NULL
        GROUP BY m.id
        ORDER BY m."nameKey", m.id`,
    }));
  },
);

/**
 * Runs a query that reads the user's zone. A zone Postgres doesn't know comes back as
 * invalid-time-zone; any other error throws.
 */
async function inKnownTimeZone<T extends object>(query: () => Promise<T>): Promise<Result<T, "invalid-time-zone">> {
  try {
    return { ok: true, ...(await query()) };
  } catch (error) {
    if (isUnknownTimeZone(error)) return { ok: false, reason: "invalid-time-zone" };
    throw error;
  }
}

/**
 * Whether Postgres refused the zone: SQLSTATE 22023, which Prisma 7 with adapter-pg wraps in a Prisma
 * error (docs/research/body-weight-sets-and-progression.md §7). The zone is the only parameter of these
 * queries that can raise it.
 */
function isUnknownTimeZone(error: unknown): boolean {
  // 7.2 reports it as P2010; later 7.x releases report unmapped adapter errors as P2039.
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2010" && error.code !== "P2039") return false;
  const cause = (error.meta?.driverAdapterError as { cause?: { originalCode?: string } } | undefined)?.cause;
  return cause?.originalCode === "22023";
}
