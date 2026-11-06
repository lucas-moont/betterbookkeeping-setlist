import { createServerOnlyFn } from "@tanstack/react-start";
import type { DbClient } from "@/lib/db.server";
import type { Result } from "@/lib/error-codes";
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

// Only the columns the screens use, so user and foreign-key ids stay on the server.
const workoutSelect = {
  id: true,
  completedAt: true,
  sets: { select: { id: true, reps: true, weight: true, movement: { select: { id: true, name: true } } } },
} as const;

type SetRow = Omit<WorkoutSet, "load">;

// The one place a stored Set becomes what callers see. Prisma Decimal turns into number here once
// weights become decimal (ADR 0002).
function toSet(row: SetRow): WorkoutSet {
  return { id: row.id, reps: row.reps, weight: row.weight, load: load(row), movement: row.movement };
}

/** Starts a new Current Workout for the user. */
export const start = createServerOnlyFn(
  async (db: DbClient, userId: string): Promise<Result<{ workout: CurrentWorkout }, never>> => {
    const workout = await db.workout.create({ data: { userId }, select: { id: true } });
    return { ok: true, workout: { id: workout.id, completedAt: null, sets: [] } };
  },
);

// "Which workout is the Current Workout" is answered here and nowhere else. Until the partial
// index of ADR 0006 allows only one, a user can have several open workouts; ordering by id makes
// every operation pick the same one that get shows.
const currentWorkoutQuery = (userId: string) =>
  ({ where: { userId, completedAt: null }, orderBy: { id: "desc" } }) as const;

async function findCurrentWorkoutId(db: DbClient, userId: string): Promise<string | null> {
  const workout = await db.workout.findFirst({ ...currentWorkoutQuery(userId), select: { id: true } });
  return workout?.id ?? null;
}

/** The user's Current Workout with its Sets, or null when there is none. */
export const get = createServerOnlyFn(async (db: DbClient, userId: string): Promise<CurrentWorkout | null> => {
  const workout = await db.workout.findFirst({ ...currentWorkoutQuery(userId), select: workoutSelect });
  if (!workout) return null;
  return { id: workout.id, completedAt: null, sets: workout.sets.map(toSet) };
});

/** Adds a Set to the user's Current Workout. */
export const addSet = createServerOnlyFn(
  async (db: DbClient, userId: string, draft: SetDraft): Promise<Result<{ set: WorkoutSet }, "no-current-workout">> => {
    const workoutId = await findCurrentWorkoutId(db, userId);
    if (!workoutId) return { ok: false, reason: "no-current-workout" };

    const set = await db.set.create({
      data: { workoutId, movementId: draft.movementId, reps: draft.reps, weight: draft.weight },
      select: workoutSelect.sets.select,
    });
    return { ok: true, set: toSet(set) };
  },
);
