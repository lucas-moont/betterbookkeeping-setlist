import { describe, expect, test } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../prisma/generated/client/client";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { expectOk } from "@/test/expect-ok";
import { createLegacyWorkout, createMovement, createUser } from "@/test/factories";
import { testDatabaseUrl } from "@/test/test-database-url";
import * as movements from "@/lib/movements";
import * as workouts from "@/lib/workouts";

// The workouts module tested through its interface against the real test database (ADR 0008).
// Every test creates its own users, so it never sees another test's rows, even with the other test
// files running in parallel.
// Checks go through the module too (get, history), never straight to the database.
const db = await getServerSidePrismaClient();

describe("get", () => {
  test("returns null when the user has no Current Workout", async () => {
    const user = await createUser(db);

    expect(await workouts.get(db, user.id)).toBeNull();
  });

  test("never returns another user's Current Workout", async () => {
    const owner = await createUser(db);
    const otherUser = await createUser(db);
    await workouts.start(db, owner.id);

    expect(await workouts.get(db, otherUser.id)).toBeNull();
  });

  test("returns a Current Workout from before start times were recorded with no startedAt", async () => {
    const user = await createUser(db);
    const legacy = await createLegacyWorkout(db, user.id);

    const current = await workouts.get(db, user.id);

    expect(current?.id).toBe(legacy.id);
    expect(current?.startedAt).toBeNull();
  });
});

describe("start", () => {
  test("starts an empty Current Workout", async () => {
    const user = await createUser(db);

    const { workout } = expectOk(await workouts.start(db, user.id));

    expect(await workouts.get(db, user.id)).toEqual({
      id: workout.id,
      startedAt: workout.startedAt,
      completedAt: null,
      sets: [],
      muscleGroups: [],
    });
  });

  test("records when the Current Workout started", async () => {
    const user = await createUser(db);
    const before = Date.now();

    expectOk(await workouts.start(db, user.id));

    const startedAt = (await workouts.get(db, user.id))?.startedAt;
    expect(startedAt).toBeInstanceOf(Date);
    expect(startedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(startedAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test("with a Current Workout already open, returns it with its Sets and starts no other", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    const { workout: first } = expectOk(await workouts.start(db, user.id));
    const set = await logSet(user.id, movement.id);

    const { workout: again } = expectOk(await workouts.start(db, user.id));

    expect(again.id).toBe(first.id);
    expect(again.startedAt).toEqual(first.startedAt);
    expect(again.sets.map((s) => s.id)).toEqual([set.id]);
    expect(again).toEqual(await workouts.get(db, user.id));
    // There was only one: completing it leaves no Current Workout behind.
    expectOk(await workouts.complete(db, user.id));
    expect(await workouts.get(db, user.id)).toBeNull();
  });

  // A double click on "Start Workout", or two server instances. Each start gets its own client: one
  // client runs its queries one after another, so the starts would never overlap. Also guards the
  // partial index of ADR 0006: the test database gets every migration, so one that ever drops the
  // index turns this red.
  test("concurrent starts start one Current Workout", async () => {
    const clients = Array.from(
      { length: 5 },
      () => new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) }),
    );
    try {
      // Three rounds, so a start that can race has three chances to show it.
      for (let round = 0; round < 3; round++) {
        const user = await createUser(db);

        const results = await Promise.all(clients.map((client) => workouts.start(client, user.id)));

        expect(new Set(results.map((result) => expectOk(result).workout.id)).size).toBe(1);
        expectOk(await workouts.complete(db, user.id, { whenEmpty: "save" }));
        expect(await workouts.get(db, user.id)).toBeNull();
      }
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()));
    }
  });

  test("starting again inside a transaction leaves the transaction usable", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);

    const workoutId = await db.$transaction(async (tx) => {
      const first = expectOk(await workouts.start(tx, user.id)).workout;
      const again = expectOk(await workouts.start(tx, user.id)).workout;
      expect(again.id).toBe(first.id);
      // A statement after the second start still runs, so Postgres didn't abort the transaction.
      expectOk(await workouts.addSet(tx, user.id, { movementId: movement.id, reps: 5, weight: 100 }, "UTC"));
      return first.id;
    });

    const current = await workouts.get(db, user.id);
    expect(current?.id).toBe(workoutId);
    expect(current?.sets).toHaveLength(1);
  });

  test("after completing, starts a new empty Current Workout and keeps the old one in the history", async () => {
    const user = await createUser(db);
    const completed = await completeEmptyWorkout(user.id);

    const { workout } = expectOk(await workouts.start(db, user.id));

    expect(workout.id).not.toBe(completed);
    expect(await workouts.get(db, user.id)).toEqual({
      id: workout.id,
      startedAt: workout.startedAt,
      completedAt: null,
      sets: [],
      muscleGroups: [],
    });
    expect(await historyIds(user.id)).toEqual([completed]);
  });
});

describe("addSet", () => {
  // What every Set of a Movement that isn't body-weight carries besides its Weight (ADR 0003).
  const noAddedWeight = { isBodyWeight: false, addedWeight: null, addedWeightNote: null };

  test("adds a Set with its Movement, Reps, Weight and Load to the Current Workout", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);

    const {
      sets: [set],
    } = expectOk(await workouts.addSet(db, user.id, { movementId: movement.id, reps: 5, weight: 225 }, "UTC"));

    expect(set).toEqual({
      id: expect.any(String),
      reps: 5,
      weight: 225,
      ...noAddedWeight,
      load: 225,
      completed: true,
      movement,
    });
    expect((await workouts.get(db, user.id))?.sets).toEqual([set]);
  });

  test.each([135.55, 0.07, 9999.99])("keeps a decimal Weight of %s as a number", async (weight) => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);

    const {
      sets: [set],
    } = expectOk(await workouts.addSet(db, user.id, { movementId: movement.id, reps: 5, weight }, "UTC"));

    expect(set).toEqual({
      id: expect.any(String),
      reps: 5,
      weight,
      ...noAddedWeight,
      load: weight,
      completed: true,
      movement,
    });
    expect((await workouts.get(db, user.id))?.sets).toEqual([set]);
  });

  test("returns no-current-workout when the user has none, and logs nothing", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);

    const result = await workouts.addSet(db, user.id, { movementId: movement.id, reps: 5, weight: 225 }, "UTC");

    expect(result).toEqual({ ok: false, reason: "no-current-workout" });
    expect(await workouts.get(db, user.id)).toBeNull();
  });

  test("after completing, returns no-current-workout and leaves the Completed Workout's Sets alone", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);
    const set = await logSet(user.id, movement.id);
    await workouts.complete(db, user.id);

    const result = await workouts.addSet(db, user.id, { movementId: movement.id, reps: 8, weight: 135 }, "UTC");

    expect(result).toEqual({ ok: false, reason: "no-current-workout" });
    expect((await workouts.history(db, user.id))[0]?.sets).toEqual([set]);
  });

  test("fails on a Movement that doesn't exist, and adds nothing", async () => {
    const user = await createUser(db);
    await workouts.start(db, user.id);

    const result = await workouts.addSet(db, user.id, { movementId: crypto.randomUUID(), reps: 5, weight: 225 }, "UTC");

    expect(result).toEqual({ ok: false, reason: "movement-not-found" });
    expect((await workouts.get(db, user.id))?.sets).toEqual([]);
  });

  // Movements belong to one user (ADR 0001). Same answer as for a Movement that doesn't exist, so
  // nobody learns which ids belong to others.
  test("fails on another user's Movement the same way, and adds nothing", async () => {
    const user = await createUser(db);
    const owner = await createUser(db);
    const othersMovement = await createMovement(db, owner.id);
    await workouts.start(db, user.id);

    const forOthersMovement = await workouts.addSet(
      db,
      user.id,
      {
        movementId: othersMovement.id,
        reps: 5,
        weight: 225,
      },
      "UTC",
    );
    const forMissingMovement = await workouts.addSet(
      db,
      user.id,
      {
        movementId: crypto.randomUUID(),
        reps: 5,
        weight: 225,
      },
      "UTC",
    );

    expect(forOthersMovement).toEqual({ ok: false, reason: "movement-not-found" });
    expect(forOthersMovement).toEqual(forMissingMovement);
    expect((await workouts.get(db, user.id))?.sets).toEqual([]);
  });

  // Every Set is added completed, as the README's "log every set as you go" (ADR 0011).
  test("adds count identical Completed Sets at once", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);

    const { sets } = expectOk(
      await workouts.addSet(db, user.id, { movementId: movement.id, reps: 6, weight: 185, count: 3 }, "UTC"),
    );

    const added = {
      id: expect.any(String),
      reps: 6,
      weight: 185,
      ...noAddedWeight,
      load: 185,
      completed: true,
      movement,
    };
    expect(sets).toEqual([added, added, added]);
    expect(new Set(sets.map((set) => set.id)).size).toBe(3);
    expect((await workouts.get(db, user.id))?.sets).toEqual(sets);
  });

  test("adds to the caller's Current Workout, never to another user's", async () => {
    const user = await createUser(db);
    const otherUser = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);
    await workouts.start(db, otherUser.id);

    await workouts.addSet(db, user.id, { movementId: movement.id, reps: 5, weight: 225 }, "UTC");

    expect((await workouts.get(db, user.id))?.sets).toHaveLength(1);
    expect((await workouts.get(db, otherUser.id))?.sets).toEqual([]);
  });
});

describe("setCompleted", () => {
  test("un-completes a Set, which makes it a Planned Set, and completes it again", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);
    const set = await logSet(user.id, movement.id);

    expect(await workouts.setCompleted(db, user.id, set.id, false)).toEqual({ ok: true });
    expect((await workouts.get(db, user.id))?.sets).toEqual([{ ...set, completed: false }]);

    expectOk(await workouts.setCompleted(db, user.id, set.id, true));
    expect((await workouts.get(db, user.id))?.sets).toEqual([set]);
  });

  test("is ok for a Set already in that state, and changes nothing", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);
    const set = await logSet(user.id, movement.id);

    expect(await workouts.setCompleted(db, user.id, set.id, true)).toEqual({ ok: true });
    expectOk(await workouts.setCompleted(db, user.id, set.id, false));
    expect(await workouts.setCompleted(db, user.id, set.id, false)).toEqual({ ok: true });

    expect((await workouts.get(db, user.id))?.sets).toEqual([{ ...set, completed: false }]);
  });

  // Tapping a Set's circle is an UPDATE, and the list must not reorder under the lifter's finger.
  test("keeps the Set in its place in the list", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);
    const added = [];
    for (const reps of [8, 3, 5]) added.push(await logSet(user.id, movement.id, { reps }));

    for (const set of added) expectOk(await workouts.setCompleted(db, user.id, set.id, false));
    expectOk(await workouts.setCompleted(db, user.id, added[0].id, true));

    expect((await workouts.get(db, user.id))?.sets.map((set) => set.id)).toEqual(added.map((set) => set.id));
  });

  test("returns set-not-found for a Set of a Completed Workout, and leaves it as it was", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);
    const set = await logSet(user.id, movement.id);
    expectOk(await workouts.complete(db, user.id));

    expect(await workouts.setCompleted(db, user.id, set.id, false)).toEqual({ ok: false, reason: "set-not-found" });
    expect((await workouts.history(db, user.id))[0].sets).toEqual([set]);
  });

  // Same answer as for an id that doesn't exist, so nobody learns which Set ids belong to others.
  test("returns set-not-found for another user's Set the same way, and leaves it as it was", async () => {
    const owner = await createUser(db);
    const otherUser = await createUser(db);
    const movement = await createMovement(db, owner.id);
    await workouts.start(db, owner.id);
    await workouts.start(db, otherUser.id);
    const set = await logSet(owner.id, movement.id);

    const forOthersSet = await workouts.setCompleted(db, otherUser.id, set.id, false);

    expect(forOthersSet).toEqual({ ok: false, reason: "set-not-found" });
    expect(forOthersSet).toEqual(await workouts.setCompleted(db, otherUser.id, crypto.randomUUID(), false));
    expect((await workouts.get(db, owner.id))?.sets).toEqual([set]);
  });

  test("a Planned Set stays in the history as not completed after the Workout is completed", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);
    const done = await logSet(user.id, movement.id);
    const notDone = await logSet(user.id, movement.id);
    expectOk(await workouts.setCompleted(db, user.id, notDone.id, false));

    expectOk(await workouts.complete(db, user.id));

    expect((await workouts.history(db, user.id))[0].sets).toEqual([done, { ...notDone, completed: false }]);
  });
});

// A Workout's Muscle Groups are read from its Completed Sets' Movements, never stored (ADR 0011).
describe("Muscle Groups", () => {
  test("come from the Completed Sets' Movements, once each, in the order of the list", async () => {
    const user = await createUser(db);
    // Logged Legs first, then Chest: the result follows the list (Chest before Legs), not the log.
    const squat = await createMovement(db, user.id, { name: "Squat", muscleGroup: "LEGS" });
    const bench = await createMovement(db, user.id, { name: "Bench Press", muscleGroup: "CHEST" });
    const incline = await createMovement(db, user.id, { name: "Incline Press", muscleGroup: "CHEST" });
    await workouts.start(db, user.id);
    await logSet(user.id, squat.id);
    await logSet(user.id, bench.id);
    await logSet(user.id, incline.id);

    expect((await workouts.get(db, user.id))?.muscleGroups).toEqual(["CHEST", "LEGS"]);
  });

  test("leave out Planned Sets and Movements without a Muscle Group", async () => {
    const user = await createUser(db);
    const bench = await createMovement(db, user.id, { muscleGroup: "CHEST" });
    const row = await createMovement(db, user.id, { name: "Row", muscleGroup: "BACK" });
    const noGroup = await createMovement(db, user.id, { name: "Farmer Carry" });
    await workouts.start(db, user.id);
    await logSet(user.id, bench.id);
    await logSet(user.id, noGroup.id);
    const planned = await logSet(user.id, row.id);
    expectOk(await workouts.setCompleted(db, user.id, planned.id, false));

    expect((await workouts.get(db, user.id))?.muscleGroups).toEqual(["CHEST"]);
    expectOk(await workouts.complete(db, user.id));
    expect((await workouts.history(db, user.id))[0].muscleGroups).toEqual(["CHEST"]);
  });

  test("follow a Movement's new Muscle Group, in old Workouts too", async () => {
    const user = await createUser(db);
    const pullUp = await createMovement(db, user.id, { name: "Pull-up", muscleGroup: "ARMS" });
    await workouts.start(db, user.id);
    await logSet(user.id, pullUp.id);
    expectOk(await workouts.complete(db, user.id));

    expectOk(await movements.setMuscleGroup(db, user.id, pullUp.id, "BACK"));

    expect((await workouts.history(db, user.id))[0].muscleGroups).toEqual(["BACK"]);
  });
});

describe("removeSet", () => {
  test("removes only the given Set", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);
    const kept = await logSet(user.id, movement.id, { reps: 5, weight: 185 });
    const removed = await logSet(user.id, movement.id, { reps: 10, weight: 135 });

    expect(await workouts.removeSet(db, user.id, removed.id)).toEqual({ ok: true });

    expect((await workouts.get(db, user.id))?.sets).toEqual([kept]);
  });

  // A Completed Workout's Sets no longer change (CONTEXT.md).
  test("returns set-not-found for a Set of a Completed Workout, and keeps it", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);
    const set = await logSet(user.id, movement.id);
    await workouts.complete(db, user.id);

    expect(await workouts.removeSet(db, user.id, set.id)).toEqual({ ok: false, reason: "set-not-found" });

    expect((await workouts.history(db, user.id))[0]?.sets).toEqual([set]);
  });

  // Same answer as for a Set that doesn't exist, so nobody learns which ids belong to others.
  test("returns set-not-found for another user's Set, and keeps it", async () => {
    const owner = await createUser(db);
    const otherUser = await createUser(db);
    const movement = await createMovement(db, owner.id);
    await workouts.start(db, owner.id);
    await workouts.start(db, otherUser.id);
    const set = await logSet(owner.id, movement.id);

    const forOthersSet = await workouts.removeSet(db, otherUser.id, set.id);
    const forMissingSet = await workouts.removeSet(db, otherUser.id, crypto.randomUUID());

    expect(forOthersSet).toEqual({ ok: false, reason: "set-not-found" });
    expect(forOthersSet).toEqual(forMissingSet);
    expect((await workouts.get(db, owner.id))?.sets).toEqual([set]);
  });

  test("removing the same Set twice returns set-not-found the second time", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);
    const set = await logSet(user.id, movement.id);
    await workouts.removeSet(db, user.id, set.id);

    expect(await workouts.removeSet(db, user.id, set.id)).toEqual({ ok: false, reason: "set-not-found" });
  });
});

describe("complete", () => {
  test("moves the Current Workout, with its Sets, into the history", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    const { workout } = expectOk(await workouts.start(db, user.id));
    const set = await logSet(user.id, movement.id, { reps: 3, weight: 315 });

    expect(await workouts.complete(db, user.id)).toEqual({ ok: true });

    expect(await workouts.get(db, user.id)).toBeNull();
    expect(await workouts.history(db, user.id)).toEqual([
      { id: workout.id, startedAt: workout.startedAt, completedAt: expect.any(Date), sets: [set], muscleGroups: [] },
    ]);
  });

  test("returns no-current-workout when the user has none", async () => {
    const user = await createUser(db);

    expect(await workouts.complete(db, user.id)).toEqual({ ok: false, reason: "no-current-workout" });
    expect(await workouts.history(db, user.id)).toEqual([]);
  });

  // A double click on "Complete Workout" must not overwrite when the workout was completed.
  test("completing twice fails the second time and keeps the first completion time", async () => {
    const user = await createUser(db);
    await workouts.start(db, user.id);
    await workouts.complete(db, user.id, { whenEmpty: "save" });
    const [completed] = await workouts.history(db, user.id);

    expect(await workouts.complete(db, user.id, { whenEmpty: "save" })).toEqual({
      ok: false,
      reason: "no-current-workout",
    });

    expect(await workouts.history(db, user.id)).toEqual([completed]);
  });

  test("leaves another user's Current Workout open", async () => {
    const user = await createUser(db);
    const otherUser = await createUser(db);
    await workouts.start(db, user.id);
    const { workout: othersWorkout } = expectOk(await workouts.start(db, otherUser.id));

    await workouts.complete(db, user.id, { whenEmpty: "save" });

    expect(await workouts.get(db, otherUser.id)).toEqual(othersWorkout);
  });

  describe("a workout with no Completed Sets", () => {
    test("returns empty-workout when it has no Sets, and stays the Current Workout", async () => {
      const user = await createUser(db);
      const { workout } = expectOk(await workouts.start(db, user.id));

      expect(await workouts.complete(db, user.id)).toEqual({ ok: false, reason: "empty-workout" });

      expect(await workouts.get(db, user.id)).toEqual(workout);
      expect(await workouts.history(db, user.id)).toEqual([]);
    });

    test("returns empty-workout when every Set is a Planned Set", async () => {
      const user = await createUser(db);
      const movement = await createMovement(db, user.id);
      const { workout } = expectOk(await workouts.start(db, user.id));
      await logPlannedSet(user.id, movement.id);

      expect(await workouts.complete(db, user.id)).toEqual({ ok: false, reason: "empty-workout" });

      expect((await workouts.get(db, user.id))?.id).toBe(workout.id);
    });

    test("save completes it as a Gym Visit, its Planned Sets still not completed", async () => {
      const user = await createUser(db);
      const movement = await createMovement(db, user.id);
      const { workout } = expectOk(await workouts.start(db, user.id));
      const set = await logPlannedSet(user.id, movement.id);

      expect(await workouts.complete(db, user.id, { whenEmpty: "save" })).toEqual({ ok: true });

      expect(await workouts.get(db, user.id)).toBeNull();
      const [visit] = await workouts.history(db, user.id);
      expect(visit.id).toBe(workout.id);
      expect(visit.sets.map(({ id, completed }) => ({ id, completed }))).toEqual([{ id: set.id, completed: false }]);
    });

    test("discard deletes it with its Planned Sets, so there is nothing to keep or show", async () => {
      const user = await createUser(db);
      const movement = await createMovement(db, user.id);
      await workouts.start(db, user.id);
      const set = await logPlannedSet(user.id, movement.id);

      expect(await workouts.complete(db, user.id, { whenEmpty: "discard" })).toEqual({ ok: true });

      expect(await workouts.get(db, user.id)).toBeNull();
      expect(await workouts.history(db, user.id)).toEqual([]);
      // The Set went with the Workout: it can't be found to complete again.
      expect(await workouts.setCompleted(db, user.id, set.id, true)).toEqual({ ok: false, reason: "set-not-found" });
    });

    // The dialog asked about an empty workout, but a Set was completed since (in another tab).
    test("discard returns workout-not-empty and deletes nothing once a Set is completed", async () => {
      const user = await createUser(db);
      const movement = await createMovement(db, user.id);
      const { workout } = expectOk(await workouts.start(db, user.id));
      const planned = await logPlannedSet(user.id, movement.id);
      const done = await logSet(user.id, movement.id, { reps: 3 });

      expect(await workouts.complete(db, user.id, { whenEmpty: "discard" })).toEqual({
        ok: false,
        reason: "workout-not-empty",
      });

      const current = await workouts.get(db, user.id);
      expect(current?.id).toBe(workout.id);
      expect(current?.sets.map((s) => s.id)).toEqual([planned.id, done.id]);
    });

    test("a workout with a Completed Set still completes with no choice, its Planned Sets kept", async () => {
      const user = await createUser(db);
      const movement = await createMovement(db, user.id);
      const { workout } = expectOk(await workouts.start(db, user.id));
      const planned = await logPlannedSet(user.id, movement.id);
      const done = await logSet(user.id, movement.id, { reps: 3 });

      expect(await workouts.complete(db, user.id)).toEqual({ ok: true });

      const [completed] = await workouts.history(db, user.id);
      expect(completed.id).toBe(workout.id);
      expect(completed.sets.map(({ id, completed }) => ({ id, completed }))).toEqual([
        { id: planned.id, completed: false },
        { id: done.id, completed: true },
      ]);
    });

    // What the reviewers found: a write from another tab between discard's read and its deletes.
    // The server function runs complete in one REPEATABLE READ transaction (completeTransaction), so
    // the whole discard works from one snapshot. Each test takes that snapshot first, then writes
    // from another client, then discards inside the same transaction: the write lands exactly in
    // the gap. Postgres then refuses the transaction, and nothing is deleted.
    describe("discard racing another tab", () => {
      const tabs = () => new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) });

      async function discardAfter(userId: string, write: () => Promise<unknown>) {
        const client = tabs();
        try {
          return await client.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT 1`; // REPEATABLE READ takes its snapshot at the first statement.
            await write();
            return workouts.complete(tx, userId, { whenEmpty: "discard" });
          }, workouts.completeTransaction);
        } finally {
          await client.$disconnect();
        }
      }

      test("a Set completed in the gap rolls the discard back", async () => {
        const user = await createUser(db);
        const movement = await createMovement(db, user.id);
        const { workout } = expectOk(await workouts.start(db, user.id));
        const first = await logPlannedSet(user.id, movement.id);
        const second = await logPlannedSet(user.id, movement.id);

        await expect(
          discardAfter(user.id, async () => expectOk(await workouts.setCompleted(db, user.id, first.id, true))),
        ).rejects.toThrow();

        const current = await workouts.get(db, user.id);
        expect(current?.id).toBe(workout.id);
        expect(current?.sets.map(({ id, completed }) => ({ id, completed }))).toEqual([
          { id: first.id, completed: true },
          { id: second.id, completed: false },
        ]);
      });

      test("a Set added in the gap rolls the discard back, Planned Sets included", async () => {
        const user = await createUser(db);
        const movement = await createMovement(db, user.id);
        const { workout } = expectOk(await workouts.start(db, user.id));
        const planned = await logPlannedSet(user.id, movement.id);
        let added: workouts.WorkoutSet | undefined;

        await expect(
          discardAfter(user.id, async () => {
            added = await logSet(user.id, movement.id, { reps: 3 });
          }),
        ).rejects.toThrow();

        const current = await workouts.get(db, user.id);
        expect(current?.id).toBe(workout.id);
        expect(current?.sets.map((set) => set.id)).toEqual([planned.id, added?.id]);
      });
    });

    test("save on a workout with a Completed Set just completes it", async () => {
      const user = await createUser(db);
      const movement = await createMovement(db, user.id);
      const { workout } = expectOk(await workouts.start(db, user.id));
      await logSet(user.id, movement.id);

      expect(await workouts.complete(db, user.id, { whenEmpty: "save" })).toEqual({ ok: true });

      expect(await historyIds(user.id)).toEqual([workout.id]);
    });
  });
});

describe("history", () => {
  test("lists only the user's Completed Workouts, most recently completed first", async () => {
    const user = await createUser(db);
    const otherUser = await createUser(db);
    const first = await completeEmptyWorkout(user.id);
    // completedAt has millisecond precision: wait, so the two completions can't tie.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await completeEmptyWorkout(user.id);
    await completeEmptyWorkout(otherUser.id);
    await workouts.start(db, user.id);

    expect(await historyIds(user.id)).toEqual([second, first]);
  });
});

describe("Set order", () => {
  test("get and history return the Sets in the order they were added", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);
    // Neither ascending nor descending, so a sort by reps can't pass by accident.
    const added = [];
    for (const reps of [8, 3, 5]) added.push(await logSet(user.id, movement.id, { reps }));

    expect((await workouts.get(db, user.id))?.sets.map((set) => set.id)).toEqual(added.map((set) => set.id));
    expectOk(await workouts.complete(db, user.id));
    expect((await workouts.history(db, user.id))[0].sets.map((set) => set.id)).toEqual(added.map((set) => set.id));
  });
});

describe("deleteWorkouts", () => {
  test("deletes every workout in the list, Sets included", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    const { workout: withSets } = expectOk(await workouts.start(db, user.id));
    await logSet(user.id, movement.id);
    await workouts.complete(db, user.id);
    const empty = await completeEmptyWorkout(user.id);

    expect(await workouts.deleteWorkouts(db, user.id, [withSets.id, empty])).toEqual({ ok: true });

    expect(await workouts.history(db, user.id)).toEqual([]);
  });

  test("keeps the workouts that aren't in the list", async () => {
    const user = await createUser(db);
    const first = await completeEmptyWorkout(user.id);
    const kept = await completeEmptyWorkout(user.id);
    const last = await completeEmptyWorkout(user.id);

    await workouts.deleteWorkouts(db, user.id, [first, last]);

    expect(await historyIds(user.id)).toEqual([kept]);
  });

  test("never deletes another user's workouts, even mixed in with the caller's own", async () => {
    const user = await createUser(db);
    const owner = await createUser(db);
    const own = await completeEmptyWorkout(user.id);
    const othersWorkout = await completeEmptyWorkout(owner.id);

    await workouts.deleteWorkouts(db, user.id, [own, othersWorkout]);

    expect(await historyIds(user.id)).toEqual([]);
    expect(await historyIds(owner.id)).toEqual([othersWorkout]);
  });

  test("never deletes the Current Workout, even when its id is in the list", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    const { workout } = expectOk(await workouts.start(db, user.id));
    const set = await logSet(user.id, movement.id);

    await workouts.deleteWorkouts(db, user.id, [workout.id]);

    const current = await workouts.get(db, user.id);
    expect(current?.id).toBe(workout.id);
    expect(current?.sets.map((s) => s.id)).toEqual([set.id]);
  });
});

/** Logs a Set in the user's Current Workout, for tests where adding it is setup, not the subject. */
async function logSet(userId: string, movementId: string, { reps = 5, weight = 225 } = {}) {
  return expectOk(await workouts.addSet(db, userId, { movementId, reps, weight }, "UTC")).sets[0];
}

/** Logs a Set and un-completes it, so it is a Planned Set. Returns it as it was logged. */
async function logPlannedSet(userId: string, movementId: string) {
  const set = await logSet(userId, movementId);
  expectOk(await workouts.setCompleted(db, userId, set.id, false));
  return set;
}

async function historyIds(userId: string) {
  return (await workouts.history(db, userId)).map((workout) => workout.id);
}

/** Completes a workout with no Sets: a Gym Visit. */
async function completeEmptyWorkout(userId: string) {
  const { workout } = expectOk(await workouts.start(db, userId));
  expectOk(await workouts.complete(db, userId, { whenEmpty: "save" }));
  return workout.id;
}
