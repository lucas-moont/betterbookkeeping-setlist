import { createServerOnlyFn } from "@tanstack/react-start";
import type { Prisma } from "../../../prisma/generated/client/client";
import type { DbClient } from "@/lib/db.server";
import type { Result } from "@/lib/error-codes";
import { ensureOwned, movementSelect, type Movement } from "@/lib/movements";
import { muscleGroups, type MuscleGroup } from "@/lib/movements/muscle-group";
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
  /** False for a Planned Set, which counts toward nothing (ADR 0011). */
  completed: boolean;
  movement: Movement;
};

/**
 * What every read of a Workout returns; the Current and Completed Workouts differ by completedAt.
 * startedAt is null on Workouts from before it was recorded: unknown, never guessed (ADR 0007).
 */
type WorkoutContent = { id: string; startedAt: Date | null; sets: WorkoutSet[]; muscleGroups: MuscleGroup[] };

export type CurrentWorkout = WorkoutContent & { completedAt: null };

export type CompletedWorkout = WorkoutContent & { completedAt: Date };

// Only the columns the screens use, so user and foreign-key ids stay on the server.
const workoutSelect = {
  id: true,
  startedAt: true,
  completedAt: true,
  sets: {
    // createdAt, then id: Sets added in one request share a createdAt (ADR 0007, ADR 0011).
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, reps: true, weight: true, completedAt: true, movement: { select: movementSelect } },
  },
} satisfies Prisma.WorkoutSelect;

type SetRow = Prisma.SetGetPayload<{ select: typeof workoutSelect.sets.select }>;

// The one place a stored Set becomes what callers see. Weight comes back as a Prisma Decimal, which
// a server function can't serialize, so it becomes a number here (ADR 0002). When the Set was
// completed stays on the server; callers only learn whether it is (ADR 0011).
function toSet(row: SetRow): WorkoutSet {
  const weight = row.weight.toNumber();
  const completed = row.completedAt !== null;
  return { id: row.id, reps: row.reps, weight, load: load({ weight }), completed, movement: row.movement };
}

/**
 * A Workout's Muscle Groups: those of its Completed Sets' Movements, once each, in the order of the
 * list. Read every time, never stored, so they follow a Movement's Muscle Group (ADR 0011).
 */
function muscleGroupsOf(sets: WorkoutSet[]): MuscleGroup[] {
  const trained = new Set(sets.filter((set) => set.completed).map((set) => set.movement.muscleGroup));
  return muscleGroups.filter((group) => trained.has(group));
}

type WorkoutRow = Prisma.WorkoutGetPayload<{ select: typeof workoutSelect }>;

// What get and history both build from a stored Workout; each adds its own completedAt.
function toWorkout(row: WorkoutRow): WorkoutContent {
  const sets = row.sets.map(toSet);
  return { id: row.id, startedAt: row.startedAt, sets, muscleGroups: muscleGroupsOf(sets) };
}

/**
 * Starts a Current Workout for the user, or returns the one already open, with its Sets: a user has
 * at most one (ADR 0006), so a double click on "Start Workout" starts one Workout.
 */
export const start = createServerOnlyFn(
  async (db: DbClient, userId: string): Promise<Result<{ workout: CurrentWorkout }, never>> => {
    // The partial unique index decides, so two concurrent starts can't both insert. ON CONFLICT
    // instead of catching P2002: after an error Postgres aborts the whole transaction, and db may be
    // a caller's transaction client (ADR 0006).
    await db.$executeRaw`
      INSERT INTO "Workout" (id, "userId", "startedAt")
      VALUES (${crypto.randomUUID()}, ${userId}, ${new Date()})
      ON CONFLICT ("userId") WHERE "completedAt" IS NULL DO NOTHING`;
    const workout = await get(db, userId);
    // Nothing to read only if a complete() ran between the two statements, or, in a caller's
    // REPEATABLE READ transaction, if the row that won the conflict was committed after it began.
    if (!workout) throw new Error("The Current Workout was completed while it was being started");
    return { ok: true, workout };
  },
);

// What makes a workout the user's Current Workout. Every Prisma query filters with this. Raw SQL
// can't reuse it, so the same rule is written out twice more: in start()'s ON CONFLICT and in the
// partial unique index of ADR 0006 (the one_current_workout migration), which lets it match one
// Workout at most. Change all three together.
const currentWorkoutWhere = (userId: string) => ({ userId, completedAt: null });

// A Set of the user's Current Workout: the only Sets removeSet and setCompleted may touch.
const currentWorkoutSetWhere = (userId: string, setId: string) => ({ id: setId, workout: currentWorkoutWhere(userId) });

async function findCurrentWorkoutId(db: DbClient, userId: string): Promise<string | null> {
  const workout = await db.workout.findFirst({
    where: currentWorkoutWhere(userId),
    select: { id: true },
  });
  return workout?.id ?? null;
}

/** The user's Current Workout with its Sets in the order they were added, or null when there is none. */
export const get = createServerOnlyFn(async (db: DbClient, userId: string): Promise<CurrentWorkout | null> => {
  const workout = await db.workout.findFirst({
    where: currentWorkoutWhere(userId),
    select: workoutSelect,
  });
  return workout && { ...toWorkout(workout), completedAt: null };
});

/**
 * Adds `count` identical Sets (one by default) to the user's Current Workout, all completed, as the
 * README's "log every set as you go" (ADR 0011). They come back in the order the reads list them.
 * The draft must already be valid (setDraftSchema). A Movement of another user gets the same
 * movement-not-found as one that doesn't exist (ADR 0001).
 */
export const addSet = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    { movementId, reps, weight, count = 1 }: SetDraft,
  ): Promise<Result<{ sets: WorkoutSet[] }, "no-current-workout" | "movement-not-found">> => {
    const workoutId = await findCurrentWorkoutId(db, userId);
    if (!workoutId) return { ok: false, reason: "no-current-workout" };
    // Movements are never deleted, so nothing can change between this check and the insert.
    const owned = await ensureOwned(db, userId, movementId);
    if (!owned.ok) return owned;

    // One INSERT: all of them get in, or none. They share one moment, so they are read back with the
    // reads' own order, which falls back to id.
    const now = new Date();
    const set = { workoutId, movementId, reps, weight, createdAt: now, completedAt: now };
    const added = await db.set.createManyAndReturn({
      data: Array.from({ length: count }, () => set),
      select: { id: true },
    });
    const rows = await db.set.findMany({
      where: { id: { in: added.map((row) => row.id) } },
      orderBy: workoutSelect.sets.orderBy,
      select: workoutSelect.sets.select,
    });
    return { ok: true, sets: rows.map(toSet) };
  },
);

/**
 * Completes a Set of the user's Current Workout, or un-completes it, which makes it a Planned Set
 * (ADR 0011). A Set already in that state is left alone, so a double click keeps when it was
 * completed. A Set of a Completed Workout or of another user gets the same set-not-found as one that
 * doesn't exist, so the answer never reveals it exists.
 */
export const setCompleted = createServerOnlyFn(
  async (db: DbClient, userId: string, setId: string, completed: boolean): Promise<Result<object, "set-not-found">> => {
    const ownSet = currentWorkoutSetWhere(userId, setId);
    // Only a Set in the other state changes, and the ownership check is in the same statement.
    const { count } = await db.set.updateMany({
      where: { ...ownSet, completedAt: completed ? null : { not: null } },
      data: { completedAt: completed ? new Date() : null },
    });
    if (count > 0) return { ok: true };
    // Nothing changed: either the Set was already in that state, or it isn't the user's to change.
    const exists = await db.set.count({ where: ownSet });
    return exists > 0 ? { ok: true } : { ok: false, reason: "set-not-found" };
  },
);

/**
 * Removes a Set from the user's Current Workout. A Set of a Completed Workout or of another user
 * gets the same set-not-found as one that doesn't exist, so the answer never reveals it exists.
 */
export const removeSet = createServerOnlyFn(
  async (db: DbClient, userId: string, setId: string): Promise<Result<object, "set-not-found">> => {
    // One statement: the ownership check and the delete can't drift apart.
    const { count } = await db.set.deleteMany({ where: currentWorkoutSetWhere(userId, setId) });
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
  return completed.map((workout) => ({ ...toWorkout(workout), completedAt: workout.completedAt as Date }));
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
