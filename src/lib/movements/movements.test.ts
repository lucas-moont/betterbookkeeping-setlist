import { describe, expect, test } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { expectOk } from "@/test/expect-ok";
import { createUser } from "@/test/factories";
import * as movements from "@/lib/movements";

// The movements module tested through its interface against the real test database (ADR 0008).
// Every test creates its own users, so fixed names never clash with other tests (ADR 0001).
const db = await getServerSidePrismaClient();

describe("create", () => {
  test("adds the Movement to the user's library", async () => {
    const user = await createUser(db);

    const { movement } = expectOk(await movements.create(db, user.id, { name: "Bench Press" }));

    expect(movement).toEqual({ id: expect.any(String), name: "Bench Press", muscleGroup: null, isBodyWeight: false });
    expect(await movements.list(db, user.id)).toEqual([movement]);
  });

  test("adds the Movement with its Muscle Group", async () => {
    const user = await createUser(db);

    const { movement } = expectOk(await movements.create(db, user.id, { name: "Bench Press", muscleGroup: "CHEST" }));

    expect(movement).toEqual({
      id: expect.any(String),
      name: "Bench Press",
      muscleGroup: "CHEST",
      isBodyWeight: false,
    });
    expect(await movements.list(db, user.id)).toEqual([movement]);
  });

  test("adds a Body-weight Movement", async () => {
    const user = await createUser(db);

    const { movement } = expectOk(await movements.create(db, user.id, { name: "Pull-up", isBodyWeight: true }));

    expect(movement).toEqual({ id: expect.any(String), name: "Pull-up", muscleGroup: null, isBodyWeight: true });
    expect(await movements.list(db, user.id)).toEqual([movement]);
  });

  test("returns movement-name-taken for a name the user already has in another case, and keeps one", async () => {
    const user = await createUser(db);
    const { movement } = expectOk(await movements.create(db, user.id, { name: "Bench Press" }));

    expect(await movements.create(db, user.id, { name: "bench press" })).toEqual({
      ok: false,
      reason: "movement-name-taken",
    });
    expect(await movements.create(db, user.id, { name: " BENCH PRESS " })).toEqual({
      ok: false,
      reason: "movement-name-taken",
    });

    expect(await movements.list(db, user.id)).toEqual([movement]);
  });

  test("lets two users each have a Movement with the same name", async () => {
    const user = await createUser(db);
    const otherUser = await createUser(db);
    expectOk(await movements.create(db, user.id, { name: "Deadlift" }));

    const { movement } = expectOk(await movements.create(db, otherUser.id, { name: "Deadlift" }));

    expect(await movements.list(db, otherUser.id)).toEqual([movement]);
  });

  // A double click on "Add" sends the same name twice at once: exactly one of them gets in.
  test("two concurrent creates with the same name add it once", async () => {
    const user = await createUser(db);

    const results = await Promise.all([
      movements.create(db, user.id, { name: "Pull-up" }),
      movements.create(db, user.id, { name: "pull-up" }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, reason: "movement-name-taken" }]);
    expect(await movements.list(db, user.id)).toHaveLength(1);
  });
});

describe("list", () => {
  test("lists only the user's own Movements", async () => {
    const user = await createUser(db);
    const otherUser = await createUser(db);
    const { movement } = expectOk(await movements.create(db, user.id, { name: "Dips" }));
    expectOk(await movements.create(db, otherUser.id, { name: "Push-up" }));

    expect(await movements.list(db, user.id)).toEqual([movement]);
  });

  test("lists the Movements in alphabetical order", async () => {
    const user = await createUser(db);
    for (const name of ["Squat", "Bench Press", "Overhead Press"])
      expectOk(await movements.create(db, user.id, { name }));

    expect((await movements.list(db, user.id)).map((movement) => movement.name)).toEqual([
      "Bench Press",
      "Overhead Press",
      "Squat",
    ]);
  });

  test("is empty for a new user", async () => {
    const user = await createUser(db);

    expect(await movements.list(db, user.id)).toEqual([]);
  });
});

describe("setMuscleGroup", () => {
  test("gives a Movement a Muscle Group, changes it, and takes it away", async () => {
    const user = await createUser(db);
    const { movement } = expectOk(await movements.create(db, user.id, { name: "Pull-up" }));

    expect(await movements.setMuscleGroup(db, user.id, movement.id, "BACK")).toEqual({ ok: true });
    expect(await movements.list(db, user.id)).toEqual([{ ...movement, muscleGroup: "BACK" }]);

    expectOk(await movements.setMuscleGroup(db, user.id, movement.id, "ARMS"));
    expect(await movements.list(db, user.id)).toEqual([{ ...movement, muscleGroup: "ARMS" }]);

    expectOk(await movements.setMuscleGroup(db, user.id, movement.id, null));
    expect(await movements.list(db, user.id)).toEqual([{ ...movement, muscleGroup: null }]);
  });

  test("returns movement-not-found for another user's Movement and leaves it as it was", async () => {
    const owner = await createUser(db);
    const otherUser = await createUser(db);
    const { movement } = expectOk(await movements.create(db, owner.id, { name: "Squat", muscleGroup: "LEGS" }));

    const forOthersMovement = await movements.setMuscleGroup(db, otherUser.id, movement.id, "CHEST");

    expect(forOthersMovement).toEqual({ ok: false, reason: "movement-not-found" });
    expect(forOthersMovement).toEqual(await movements.setMuscleGroup(db, otherUser.id, crypto.randomUUID(), "CHEST"));
    expect(await movements.list(db, owner.id)).toEqual([movement]);
  });
});

describe("ensureOwned", () => {
  test("is ok for the user's own Movement", async () => {
    const user = await createUser(db);
    const { movement } = expectOk(await movements.create(db, user.id, { name: "Bench Press" }));

    expect(await movements.ensureOwned(db, user.id, movement.id)).toEqual({ ok: true });
  });

  test("returns movement-not-found for another user's Movement, the same as for one that doesn't exist", async () => {
    const owner = await createUser(db);
    const otherUser = await createUser(db);
    const { movement } = expectOk(await movements.create(db, owner.id, { name: "Bench Press" }));

    const forOthersMovement = await movements.ensureOwned(db, otherUser.id, movement.id);

    expect(forOthersMovement).toEqual({ ok: false, reason: "movement-not-found" });
    expect(forOthersMovement).toEqual(await movements.ensureOwned(db, otherUser.id, crypto.randomUUID()));
  });
});
