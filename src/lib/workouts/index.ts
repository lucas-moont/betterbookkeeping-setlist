import { createServerOnlyFn } from "@tanstack/react-start";
import type { Prisma } from "../../../prisma/generated/client/client";
import type { DbClient } from "@/lib/db.server";
import type { Result } from "@/lib/error-codes";
import * as bodyWeight from "@/lib/body-weight";
import { bodyWeightSchema } from "@/lib/body-weight/entry";
import { todayIsoDate } from "@/lib/format";
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
  /** For a body-weight Set: its Body Weight Snapshot, or the Latest Body Weight while it is planned (ADR 0003). */
  weight: number;
  /** Signed: positive is extra load, negative is assistance. Only on body-weight Sets, always with its note. */
  addedWeight: number | null;
  addedWeightNote: string | null;
  /** Whether the Set was logged as body-weight, fixed when it was added; not the Movement's current flag. */
  isBodyWeight: boolean;
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
    select: {
      id: true,
      reps: true,
      weight: true,
      isBodyWeight: true,
      addedWeight: true,
      addedWeightNote: true,
      completedAt: true,
      movement: { select: movementSelect },
    },
  },
} satisfies Prisma.WorkoutSelect;

type SetRow = Prisma.SetGetPayload<{ select: typeof workoutSelect.sets.select }>;

// The one place a stored Set becomes what callers see. Weights come back as Prisma Decimals, which
// a server function can't serialize, so they become numbers here (ADR 0002). When the Set was
// completed stays on the server; callers only learn whether it is (ADR 0011).
//
// A Planned body-weight Set has no Body Weight Snapshot: its stored weight is the last one it took,
// and it shows latestBodyWeight instead, when the caller passes one (ADR 0011).
function toSet(row: SetRow, latestBodyWeight: number | null = null): WorkoutSet {
  const completed = row.completedAt !== null;
  const showsLatest = row.isBodyWeight && !completed && latestBodyWeight !== null;
  const weight = showsLatest ? latestBodyWeight : row.weight.toNumber();
  const addedWeight = row.addedWeight?.toNumber() ?? null;
  return {
    id: row.id,
    reps: row.reps,
    weight,
    addedWeight,
    addedWeightNote: row.addedWeightNote,
    isBodyWeight: row.isBodyWeight,
    load: load({ weight, addedWeight }),
    completed,
    movement: row.movement,
  };
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
function toWorkout(row: WorkoutRow, latestBodyWeight: number | null = null): WorkoutContent {
  const sets = row.sets.map((set) => toSet(set, latestBodyWeight));
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

// A Completed Set (ADR 0011); a Planned Set has no completedAt.
const completedSetWhere = { completedAt: { not: null } };

/**
 * Whether the assistance in an Added Weight is more than the body weight, which would make Load
 * negative (ADR 0003). The Set_load_not_negative CHECK refuses it too; checking first turns it into
 * an expected failure instead of a database error.
 */
function assistanceExceeds(weight: number, addedWeight: number | null | undefined): boolean {
  return addedWeight != null && load({ weight, addedWeight }) < 0;
}

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
  if (!workout) return null;
  // A Planned body-weight Set shows the Latest Body Weight of the moment, so it is only read when
  // the Workout has one (ADR 0011).
  const showsBodyWeight = workout.sets.some((set) => set.isBodyWeight && set.completedAt === null);
  const latest = showsBodyWeight ? await bodyWeight.latest(db, userId) : null;
  return { ...toWorkout(workout, latest?.weight ?? null), completedAt: null };
});

/**
 * Adds `count` identical Sets (one by default) to the user's Current Workout, all completed, as the
 * README's "log every set as you go" (ADR 0011). They come back in the order the reads list them.
 * The draft must already be valid (setDraftSchema). A Movement of another user gets the same
 * movement-not-found as one that doesn't exist (ADR 0001).
 *
 * A Set of a Body-weight Movement takes the Latest Body Weight as its Weight, never the one sent
 * (ADR 0003). With no Body Weight Entry yet, the sent weight is the user's body weight: it becomes
 * the snapshot and today's entry in the user's time zone, returned as recordedBodyWeight. Run it in a
 * transaction, so the entry and the Sets are saved together or not at all.
 */
export const addSet = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    { movementId, reps, weight, count = 1, addedWeight, addedWeightNote }: SetDraft,
    timeZone: string,
  ): Promise<
    Result<
      { sets: WorkoutSet[]; recordedBodyWeight: bodyWeight.BodyWeightEntry | null },
      | "no-current-workout"
      | "movement-not-found"
      | "added-weight-not-allowed"
      | "body-weight-required"
      | "assistance-exceeds-body-weight"
      | "body-weight-date-in-future"
    >
  > => {
    const workoutId = await findCurrentWorkoutId(db, userId);
    if (!workoutId) return { ok: false, reason: "no-current-workout" };
    // Movements are never deleted, so nothing can change between this check and the insert.
    const owned = await ensureOwned(db, userId, movementId);
    if (!owned.ok) return owned;
    // The Set is body-weight if its Movement is right now, and stays so whatever the flag does later.
    const { isBodyWeight } = owned.movement;
    // Any other Set's weight is what's on the bar, so there is nothing to add to it.
    if (!isBodyWeight && addedWeight !== undefined) return { ok: false, reason: "added-weight-not-allowed" };

    // A body-weight Set's Weight is its Body Weight Snapshot: the Latest Body Weight, never what the
    // form sent (ADR 0003). Without one, the form sent the user's body weight.
    const latest = isBodyWeight ? await bodyWeight.latest(db, userId) : null;
    const firstBodyWeight = isBodyWeight && !latest;
    if (firstBodyWeight && !bodyWeightSchema.safeParse(weight).success) {
      return { ok: false, reason: "body-weight-required" };
    }
    const setWeight = latest?.weight ?? weight;
    if (assistanceExceeds(setWeight, addedWeight)) return { ok: false, reason: "assistance-exceeds-body-weight" };

    // Every refusal comes before the first write, so none leaves an entry behind.
    let recordedBodyWeight: bodyWeight.BodyWeightEntry | null = null;
    if (firstBodyWeight) {
      const recorded = await bodyWeight.record(db, userId, { date: todayIsoDate(timeZone), weight }, timeZone);
      // It records today, so record()'s future-date check passes; its reason is still passed on.
      if (!recorded.ok) return recorded;
      recordedBodyWeight = recorded.entry;
    }

    // One INSERT: all of them get in, or none. They share one moment, so they are read back with the
    // reads' own order, which falls back to id.
    const now = new Date();
    const set = {
      workoutId,
      movementId,
      reps,
      weight: setWeight,
      isBodyWeight,
      addedWeight: addedWeight ?? null,
      addedWeightNote: addedWeightNote ?? null,
      createdAt: now,
      completedAt: now,
    };
    const added = await db.set.createManyAndReturn({
      data: Array.from({ length: count }, () => set),
      select: { id: true },
    });
    const rows = await db.set.findMany({
      where: { id: { in: added.map((row) => row.id) } },
      orderBy: workoutSelect.sets.orderBy,
      select: workoutSelect.sets.select,
    });
    return { ok: true, sets: rows.map((row) => toSet(row)), recordedBodyWeight };
  },
);

/**
 * Completes a Set of the user's Current Workout, or un-completes it, which makes it a Planned Set
 * (ADR 0011). A Set already in that state is left alone, so a double click keeps when it was
 * completed, and its Body Weight Snapshot. A Set of a Completed Workout or of another user gets the
 * same set-not-found as one that doesn't exist, so the answer never reveals it exists.
 *
 * A Set logged as body-weight takes a new snapshot when it becomes completed: the Latest Body
 * Weight, or the weight it had when the user has no entry left. Its Added Weight is checked against
 * that snapshot, so assistance now above the body weight gets assistance-exceeds-body-weight and the
 * Set stays planned (ADR 0003).
 */
export const setCompleted = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    setId: string,
    completed: boolean,
  ): Promise<Result<object, "set-not-found" | "assistance-exceeds-body-weight">> => {
    const ownSet = currentWorkoutSetWhere(userId, setId);
    // isBodyWeight and addedWeight never change once the Set exists, so reading them first is safe.
    const set = await db.set.findFirst({
      where: ownSet,
      select: { completedAt: true, isBodyWeight: true, addedWeight: true },
    });
    if (!set) return { ok: false, reason: "set-not-found" };
    if ((set.completedAt !== null) === completed) return { ok: true };

    // The per-set flag decides, never the Movement's current one (ADR 0003).
    const snapshot = completed && set.isBodyWeight ? (await bodyWeight.latest(db, userId))?.weight : undefined;
    // Checked against the very weight written below, so the Set_load_not_negative CHECK can't fire,
    // even if a Body Weight Entry is recorded in between.
    if (snapshot !== undefined && assistanceExceeds(snapshot, set.addedWeight?.toNumber())) {
      return { ok: false, reason: "assistance-exceeds-body-weight" };
    }

    // Only a Set still in the other state changes, so a concurrent change between the read and this
    // write is kept.
    const { count } = await db.set.updateMany({
      where: { ...ownSet, completedAt: completed ? null : { not: null } },
      data: { completedAt: completed ? new Date() : null, ...(snapshot !== undefined && { weight: snapshot }) },
    });
    if (count > 0) return { ok: true };
    // Nothing changed: another request already put the Set in that state, or removed it (or completed
    // its Workout) since the read.
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

/** What to do with a Current Workout that has no Completed Sets: keep it as a Gym Visit, or delete it. */
export const whenEmptyChoices = ["save", "discard"] as const;
export type WhenEmpty = (typeof whenEmptyChoices)[number];

/**
 * How the server function runs complete: in one REPEATABLE READ transaction, so the read that finds
 * the workout empty and discard's deletes work from one snapshot. A Set completed or added from
 * another tab after that read makes Postgres refuse the transaction (a serialization or foreign key
 * error, so a generic toast), and nothing is deleted.
 */
export const completeTransaction = { isolationLevel: "RepeatableRead" } as const;

/**
 * Completes the user's Current Workout, which moves it into the history. One with no Completed Sets
 * (Planned Sets don't count) is never completed or deleted without the user's choice: with no
 * whenEmpty it returns empty-workout, so the page can ask. "save" keeps it as a Gym Visit, Planned
 * Sets and all. "discard" deletes it with its Sets, and refuses with workout-not-empty once it has
 * a Completed Set: the user chose to discard a workout with nothing done, not this one.
 */
export const complete = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    { whenEmpty }: { whenEmpty?: WhenEmpty } = {},
  ): Promise<Result<object, "no-current-workout" | "empty-workout" | "workout-not-empty">> => {
    const workout = await db.workout.findFirst({
      where: currentWorkoutWhere(userId),
      select: { id: true, sets: { where: completedSetWhere, take: 1, select: { id: true } } },
    });
    if (!workout) return { ok: false, reason: "no-current-workout" };
    const empty = workout.sets.length === 0;

    if (whenEmpty === "discard") {
      return empty ? discard(db, userId, workout.id) : { ok: false, reason: "workout-not-empty" };
    }
    if (whenEmpty === undefined && empty) return { ok: false, reason: "empty-workout" };

    // With no choice, the update requires a Completed Set itself, so on a plain client the check and
    // the write are one statement. Inside completeTransaction they share the snapshot instead: a Set
    // un-completed from another tab after the read isn't seen, and the workout completes as it was
    // when the user clicked.
    const { count } = await db.workout.updateMany({
      where: {
        id: workout.id,
        ...currentWorkoutWhere(userId),
        ...(whenEmpty === undefined && { sets: { some: completedSetWhere } }),
      },
      data: { completedAt: new Date() },
    });
    if (count > 0) return { ok: true };
    return { ok: false, reason: whenEmpty === undefined ? "empty-workout" : "no-current-workout" };
  },
);

/**
 * Deletes the user's Current Workout and its Sets, after complete found it has no Completed Set.
 * The Set FK is RESTRICT, so the Sets go first. Two statements: only the caller's transaction
 * (completeTransaction) makes them all or nothing and keeps them on the snapshot that found the
 * workout empty. Without it, a Set added between them would leave the Planned Sets deleted and the
 * workout standing.
 */
async function discard(db: DbClient, userId: string, workoutId: string): Promise<Result<object, never>> {
  const workout = { id: workoutId, ...currentWorkoutWhere(userId) };
  await db.set.deleteMany({ where: { workout } });
  await db.workout.deleteMany({ where: workout });
  return { ok: true };
}

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
 * Deletes the user's completed workouts with these ids, with their Sets. Ids of other users'
 * workouts and of the Current Workout are ignored: the history only lists completed ones, so a
 * Current Workout's id here is a stale or forged request, and deleting it would lose logged Sets.
 * Two statements, not a transaction: db may already be a transaction client, and Prisma 7.2
 * can't nest one (docs/research/testing-prisma-postgres.md).
 */
export const deleteWorkouts = createServerOnlyFn(
  async (db: DbClient, userId: string, workoutIds: string[]): Promise<Result<object, never>> => {
    const owned = { id: { in: workoutIds }, userId, completedAt: { not: null } };
    await db.set.deleteMany({ where: { workout: owned } });
    await db.workout.deleteMany({ where: owned });
    return { ok: true };
  },
);
