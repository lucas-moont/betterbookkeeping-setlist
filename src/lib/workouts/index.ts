import { createServerOnlyFn } from "@tanstack/react-start";
import type { Prisma } from "../../../prisma/generated/client/client";
import type { DbClient } from "@/lib/db.server";
import type { Result } from "@/lib/error-codes";
import { ensureOwned } from "@/lib/movements";
import { load } from "@/lib/weight";
import type { SetDraft } from "./set-draft";

// The workouts module (ADR 0010): the rules of the Current Workout and of the history, in one place.
// Every operation takes (db, userId, ...): it never opens its own client, so a caller can pass a
// transaction client, and it only ever touches that user's rows.

export type WorkoutSet = {
  id: string;
  reps: number;
  weight: number;
  load: number;
  movement: { id: string; name: string };
};

export type CurrentWorkout = { id: string; completedAt: null; sets: WorkoutSet[] };

export type CompletedWorkout = { id: string; completedAt: Date; sets: WorkoutSet[] };

// Only the columns the screens use, so user and foreign-key ids stay on the server.
const workoutSelect = {
  id: true,
  completedAt: true,
  sets: { select: { id: true, reps: true, weight: true, movement: { select: { id: true, name: true } } } },
} as const;

type SetRow = Prisma.SetGetPayload<{ select: typeof workoutSelect.sets.select }>;

// The one place a stored Set becomes what callers see. Weight comes back as a Prisma Decimal, which
// a server function can't serialize, so it becomes a number here (ADR 0002).
function toSet(row: SetRow): WorkoutSet {
  const weight = row.weight.toNumber();
  return { id: row.id, reps: row.reps, weight, load: load({ weight }), movement: row.movement };
}

/** Starts a new Current Workout for the user. */
export const start = createServerOnlyFn(
  async (db: DbClient, userId: string): Promise<Result<{ workout: CurrentWorkout }, never>> => {
    const workout = await db.workout.create({ data: { userId }, select: { id: true } });
    return { ok: true, workout: { id: workout.id, completedAt: null, sets: [] } };
  },
);

// What makes a workout the user's Current Workout. Every operation filters with this, and nothing
// else spells the rule out.
const currentWorkoutWhere = (userId: string) => ({ userId, completedAt: null });

// Until the partial index of ADR 0006 allows only one, a user can have several open workouts. This
// tie-break makes get, addSet and complete pick the same one; delete it once the index exists.
const newestFirst = { id: "desc" } as const;

async function findCurrentWorkoutId(db: DbClient, userId: string): Promise<string | null> {
  const workout = await db.workout.findFirst({
    where: currentWorkoutWhere(userId),
    orderBy: newestFirst,
    select: { id: true },
  });
  return workout?.id ?? null;
}

/**
 * The user's Current Workout with its Sets, or null when there is none. The Sets come in no defined
 * order until they record when they were logged (ADR 0007).
 */
export const get = createServerOnlyFn(async (db: DbClient, userId: string): Promise<CurrentWorkout | null> => {
  const workout = await db.workout.findFirst({
    where: currentWorkoutWhere(userId),
    orderBy: newestFirst,
    select: workoutSelect,
  });
  if (!workout) return null;
  return { id: workout.id, completedAt: null, sets: workout.sets.map(toSet) };
});

/**
 * Adds a Set to the user's Current Workout. The draft must already be valid (setDraftSchema). A
 * Movement of another user gets the same movement-not-found as one that doesn't exist (ADR 0001).
 */
export const addSet = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    draft: SetDraft,
  ): Promise<Result<{ set: WorkoutSet }, "no-current-workout" | "movement-not-found">> => {
    const workoutId = await findCurrentWorkoutId(db, userId);
    if (!workoutId) return { ok: false, reason: "no-current-workout" };
    // Movements are never deleted, so nothing can change between this check and the insert.
    const owned = await ensureOwned(db, userId, draft.movementId);
    if (!owned.ok) return owned;

    const set = await db.set.create({
      data: { workoutId, movementId: draft.movementId, reps: draft.reps, weight: draft.weight },
      select: workoutSelect.sets.select,
    });
    return { ok: true, set: toSet(set) };
  },
);

/**
 * Removes a Set from the user's Current Workout. A Set of a Completed Workout or of another user
 * gets the same set-not-found as one that doesn't exist, so the answer never reveals it exists.
 */
export const removeSet = createServerOnlyFn(
  async (db: DbClient, userId: string, setId: string): Promise<Result<object, "set-not-found">> => {
    // One statement: the ownership check and the delete can't drift apart.
    const { count } = await db.set.deleteMany({ where: { id: setId, workout: currentWorkoutWhere(userId) } });
    return count === 0 ? { ok: false, reason: "set-not-found" } : { ok: true };
  },
);

/** Completes the user's Current Workout, which moves it into the history. */
export const complete = createServerOnlyFn(
  async (db: DbClient, userId: string): Promise<Result<object, "no-current-workout">> => {
    const workoutId = await findCurrentWorkoutId(db, userId);
    if (!workoutId) return { ok: false, reason: "no-current-workout" };

    await db.workout.update({ where: { id: workoutId }, data: { completedAt: new Date() } });
    return { ok: true };
  },
);

/** The user's Completed Workouts with their Sets, most recently completed first. */
export const history = createServerOnlyFn(async (db: DbClient, userId: string): Promise<CompletedWorkout[]> => {
  const completed = await db.workout.findMany({
    where: { userId, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    select: workoutSelect,
  });
  // The where clause guarantees completedAt is set.
  return completed.map((workout) => ({
    id: workout.id,
    completedAt: workout.completedAt as Date,
    sets: workout.sets.map(toSet),
  }));
});

/**
 * Deletes the user's workouts with these ids, with their Sets. Ids of other users' workouts are
 * ignored. Two statements, not a transaction: db may already be a transaction client, and Prisma 7.2
 * can't nest one (docs/research/testing-prisma-postgres.md).
 */
export const deleteWorkouts = createServerOnlyFn(
  async (db: DbClient, userId: string, workoutIds: string[]): Promise<Result<object, never>> => {
    const owned = { id: { in: workoutIds }, userId };
    await db.set.deleteMany({ where: { workout: owned } });
    await db.workout.deleteMany({ where: owned });
    return { ok: true };
  },
);
