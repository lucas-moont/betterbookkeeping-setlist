import { describe, expect, test } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import type { ErrorCode, Result } from "@/lib/error-codes";
import { createUser } from "@/test/factories";
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
