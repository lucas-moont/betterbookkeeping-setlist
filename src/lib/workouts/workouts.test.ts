import { describe, expect, test } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import type { ErrorCode, Result } from "@/lib/error-codes";
import { createMovement, createUser } from "@/test/factories";
import * as workouts from "@/lib/workouts";

// The workouts module tested through its interface against the real test database (ADR 0008).
// Every test creates its own users, so tests run in parallel and never see each other's rows.
// Checks go through the module too (get, history), never straight to the database.
const db = await getServerSidePrismaClient();

/** Narrows a module Result to its success branch, failing the test with the reason otherwise. */
function expectOk<T extends object>(result: Result<T, ErrorCode>) {
  if (!result.ok) throw new Error(`Expected the operation to succeed, but it returned "${result.reason}"`);
  return result;
}

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

    expect(await workouts.get(db, user.id)).toEqual({ id: workout.id, completedAt: null, sets: [] });
  });
});

describe("addSet", () => {
  test("adds a Set with its Movement, Reps, Weight and Load to the Current Workout", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db);
    await workouts.start(db, user.id);

    const { set } = expectOk(await workouts.addSet(db, user.id, { movementId: movement.id, reps: 5, weight: 225 }));

    expect(set).toEqual({ id: expect.any(String), reps: 5, weight: 225, load: 225, movement });
    expect((await workouts.get(db, user.id))?.sets).toEqual([set]);
  });

  test("returns no-current-workout when the user has none, and logs nothing", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db);

    const result = await workouts.addSet(db, user.id, { movementId: movement.id, reps: 5, weight: 225 });

    expect(result).toEqual({ ok: false, reason: "no-current-workout" });
    expect(await workouts.get(db, user.id)).toBeNull();
  });

  // Unchanged on purpose: the database rejects the unknown movement and the call throws. A
  // movement-not-found code arrives with movement ownership (ADR 0001).
  test("fails on a Movement that doesn't exist, and adds nothing", async () => {
    const user = await createUser(db);
    await workouts.start(db, user.id);

    await expect(
      workouts.addSet(db, user.id, { movementId: crypto.randomUUID(), reps: 5, weight: 225 }),
    ).rejects.toThrow();
    expect((await workouts.get(db, user.id))?.sets).toEqual([]);
  });

  test("adds to the caller's Current Workout, never to another user's", async () => {
    const user = await createUser(db);
    const otherUser = await createUser(db);
    const movement = await createMovement(db);
    await workouts.start(db, user.id);
    await workouts.start(db, otherUser.id);

    await workouts.addSet(db, user.id, { movementId: movement.id, reps: 5, weight: 225 });

    expect((await workouts.get(db, user.id))?.sets).toHaveLength(1);
    expect((await workouts.get(db, otherUser.id))?.sets).toEqual([]);
  });
});
