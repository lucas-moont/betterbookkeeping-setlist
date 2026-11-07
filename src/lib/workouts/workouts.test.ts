import { describe, expect, test } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { expectOk } from "@/test/expect-ok";
import { createMovement, createUser } from "@/test/factories";
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
});

describe("start", () => {
  test("starts an empty Current Workout", async () => {
    const user = await createUser(db);

    const { workout } = expectOk(await workouts.start(db, user.id));

    expect(await workouts.get(db, user.id)).toEqual({ id: workout.id, completedAt: null, sets: [], muscleGroups: [] });
  });

  test("after completing, starts a new empty Current Workout and keeps the old one in the history", async () => {
    const user = await createUser(db);
    const completed = await completeEmptyWorkout(user.id);

    const { workout } = expectOk(await workouts.start(db, user.id));

    expect(workout.id).not.toBe(completed);
    expect(await workouts.get(db, user.id)).toEqual({ id: workout.id, completedAt: null, sets: [], muscleGroups: [] });
    expect(await historyIds(user.id)).toEqual([completed]);
  });
});

describe("addSet", () => {
  test("adds a Set with its Movement, Reps, Weight and Load to the Current Workout", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);

    const {
      sets: [set],
    } = expectOk(await workouts.addSet(db, user.id, { movementId: movement.id, reps: 5, weight: 225 }));

    expect(set).toEqual({ id: expect.any(String), reps: 5, weight: 225, load: 225, completed: true, movement });
    expect((await workouts.get(db, user.id))?.sets).toEqual([set]);
  });

  test.each([135.55, 0.07, 9999.99])("keeps a decimal Weight of %s as a number", async (weight) => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);

    const {
      sets: [set],
    } = expectOk(await workouts.addSet(db, user.id, { movementId: movement.id, reps: 5, weight }));

    expect(set).toEqual({ id: expect.any(String), reps: 5, weight, load: weight, completed: true, movement });
    expect((await workouts.get(db, user.id))?.sets).toEqual([set]);
  });

  test("returns no-current-workout when the user has none, and logs nothing", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);

    const result = await workouts.addSet(db, user.id, { movementId: movement.id, reps: 5, weight: 225 });

    expect(result).toEqual({ ok: false, reason: "no-current-workout" });
    expect(await workouts.get(db, user.id)).toBeNull();
  });

  test("after completing, returns no-current-workout and leaves the Completed Workout's Sets alone", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id);
    await workouts.start(db, user.id);
    const set = await logSet(user.id, movement.id);
    await workouts.complete(db, user.id);

    const result = await workouts.addSet(db, user.id, { movementId: movement.id, reps: 8, weight: 135 });

    expect(result).toEqual({ ok: false, reason: "no-current-workout" });
    expect((await workouts.history(db, user.id))[0]?.sets).toEqual([set]);
  });

  test("fails on a Movement that doesn't exist, and adds nothing", async () => {
    const user = await createUser(db);
    await workouts.start(db, user.id);

    const result = await workouts.addSet(db, user.id, { movementId: crypto.randomUUID(), reps: 5, weight: 225 });

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

    const forOthersMovement = await workouts.addSet(db, user.id, {
      movementId: othersMovement.id,
      reps: 5,
      weight: 225,
    });
    const forMissingMovement = await workouts.addSet(db, user.id, {
      movementId: crypto.randomUUID(),
      reps: 5,
      weight: 225,
    });

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
      await workouts.addSet(db, user.id, { movementId: movement.id, reps: 6, weight: 185, count: 3 }),
    );

    const added = { id: expect.any(String), reps: 6, weight: 185, load: 185, completed: true, movement };
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

    await workouts.addSet(db, user.id, { movementId: movement.id, reps: 5, weight: 225 });

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
      { id: workout.id, completedAt: expect.any(Date), sets: [set], muscleGroups: [] },
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
    await workouts.complete(db, user.id);
    const [completed] = await workouts.history(db, user.id);

    expect(await workouts.complete(db, user.id)).toEqual({ ok: false, reason: "no-current-workout" });

    expect(await workouts.history(db, user.id)).toEqual([completed]);
  });

  test("leaves another user's Current Workout open", async () => {
    const user = await createUser(db);
    const otherUser = await createUser(db);
    await workouts.start(db, user.id);
    const { workout: othersWorkout } = expectOk(await workouts.start(db, otherUser.id));

    await workouts.complete(db, user.id);

    expect(await workouts.get(db, otherUser.id)).toEqual(othersWorkout);
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
});

/** Logs a Set in the user's Current Workout, for tests where adding it is setup, not the subject. */
async function logSet(userId: string, movementId: string, { reps = 5, weight = 225 } = {}) {
  return expectOk(await workouts.addSet(db, userId, { movementId, reps, weight })).sets[0];
}

async function historyIds(userId: string) {
  return (await workouts.history(db, userId)).map((workout) => workout.id);
}

async function completeEmptyWorkout(userId: string) {
  const { workout } = expectOk(await workouts.start(db, userId));
  expectOk(await workouts.complete(db, userId));
  return workout.id;
}
