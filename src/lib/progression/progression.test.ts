import { afterEach, describe, expect, test, vi } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { expectOk } from "@/test/expect-ok";
import { createMovement, createUser } from "@/test/factories";
import * as bodyWeight from "@/lib/body-weight";
import * as progression from "@/lib/progression";
import * as workouts from "@/lib/workouts";
import type { SetDraft } from "@/lib/workouts/set-draft";

// The progression module tested through its interface against the real test database (ADR 0008).
// Workouts are logged through the workouts module with a frozen clock, so each one is completed at a
// known instant; every check reads back through getMetrics or listMovements.
const db = await getServerSidePrismaClient();

const saoPaulo = "America/Sao_Paulo";

afterEach(() => {
  vi.useRealTimers();
});

/** Freezes the clock (only Date, so the database driver's timers keep running). */
function setNow(instant: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(instant));
}

type LoggedSet = Omit<SetDraft, "movementId"> & { movementId: string; planned?: number };

/**
 * Logs a Workout completed at `completedAt`: starts it, adds each Set, un-completes the first
 * `planned` of each addSet (they become Planned Sets), and completes the Workout. Returns the Sets
 * addSet returned, so a test can compare with the Load the TypeScript load() computed.
 */
async function logWorkout(userId: string, completedAt: string, sets: LoggedSet[]) {
  setNow(completedAt);
  expectOk(await workouts.start(db, userId));
  const added: workouts.WorkoutSet[] = [];
  for (const { planned = 0, ...draft } of sets) {
    const result = expectOk(await workouts.addSet(db, userId, draft, "UTC"));
    for (const set of result.sets.slice(0, planned)) expectOk(await workouts.setCompleted(db, userId, set.id, false));
    added.push(...result.sets);
  }
  expectOk(await workouts.complete(db, userId));
  vi.useRealTimers();
  return added;
}

describe("getMetrics", () => {
  test("gives one point per Training Day, in the user's time zone, oldest first", async () => {
    const user = await createUser(db);
    const bench = await createMovement(db, user.id);
    // Logged out of order, so only the query can sort them.
    await logWorkout(user.id, "2026-11-07T15:00:00Z", [{ movementId: bench.id, reps: 5, weight: 200 }]);
    // 23:00 on Nov 6 in São Paulo is 02:00 on Nov 7 in UTC.
    await logWorkout(user.id, "2026-11-07T02:00:00Z", [{ movementId: bench.id, reps: 5, weight: 100 }]);

    const inSaoPaulo = expectOk(await progression.getMetrics(db, user.id, bench.id, saoPaulo));
    const inUtc = expectOk(await progression.getMetrics(db, user.id, bench.id, "UTC"));

    expect(inSaoPaulo.days).toEqual([
      { date: "2026-11-06", maxWeight: 100, totalReps: 5, totalVolume: 500, workouts: 1 },
      { date: "2026-11-07", maxWeight: 200, totalReps: 5, totalVolume: 1000, workouts: 1 },
    ]);
    expect(inUtc.days).toEqual([{ date: "2026-11-07", maxWeight: 200, totalReps: 10, totalVolume: 1500, workouts: 2 }]);
  });

  test("combines two Workouts on the same Training Day into one point", async () => {
    const user = await createUser(db);
    const bench = await createMovement(db, user.id);
    await logWorkout(user.id, "2026-11-03T10:00:00Z", [{ movementId: bench.id, reps: 5, weight: 100 }]);
    await logWorkout(user.id, "2026-11-03T18:00:00Z", [
      { movementId: bench.id, reps: 3, weight: 120 },
      { movementId: bench.id, reps: 10, weight: 80 },
    ]);

    const { days } = expectOk(await progression.getMetrics(db, user.id, bench.id, "UTC"));

    expect(days).toEqual([{ date: "2026-11-03", maxWeight: 120, totalReps: 18, totalVolume: 1660, workouts: 2 }]);
  });

  test("counts only the movement asked for, and only Completed Sets of Completed Workouts", async () => {
    const user = await createUser(db);
    const bench = await createMovement(db, user.id);
    const squat = await createMovement(db, user.id, { name: "Squat" });
    await logWorkout(user.id, "2026-11-03T10:00:00Z", [
      // One completed, two planned: the planned ones are heavier, so they would show if counted.
      { movementId: bench.id, reps: 5, weight: 300, count: 2, planned: 2 },
      { movementId: bench.id, reps: 8, weight: 135 },
      { movementId: squat.id, reps: 5, weight: 225 },
    ]);
    // The Current Workout isn't in the history yet.
    setNow("2026-11-04T10:00:00Z");
    expectOk(await workouts.start(db, user.id));
    expectOk(await workouts.addSet(db, user.id, { movementId: bench.id, reps: 5, weight: 400 }, "UTC"));
    vi.useRealTimers();

    const { days } = expectOk(await progression.getMetrics(db, user.id, bench.id, "UTC"));

    expect(days).toEqual([{ date: "2026-11-03", maxWeight: 135, totalReps: 8, totalVolume: 1080, workouts: 1 }]);
  });

  test("a body-weight Set's Load is its Body Weight Snapshot plus its Added Weight", async () => {
    const user = await createUser(db);
    const pullUp = await createMovement(db, user.id, { name: "Pull-up", isBodyWeight: true });
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-01", weight: 172.4 }, "UTC"));
    await logWorkout(user.id, "2026-11-03T10:00:00Z", [
      { movementId: pullUp.id, reps: 6, weight: 0, addedWeight: -20, addedWeightNote: "red band" },
    ]);

    const { days } = expectOk(await progression.getMetrics(db, user.id, pullUp.id, "UTC"));

    expect(days).toEqual([{ date: "2026-11-03", maxWeight: 152.4, totalReps: 6, totalVolume: 914.4, workouts: 1 }]);
  });

  test("its Load is the same as load() in TypeScript, with no, positive and negative Added Weight", async () => {
    const user = await createUser(db);
    const pullUp = await createMovement(db, user.id, { name: "Pull-up", isBodyWeight: true });
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-01", weight: 172.45 }, "UTC"));
    const draft = { movementId: pullUp.id, reps: 1, weight: 0 };
    const sets = [
      ...(await logWorkout(user.id, "2026-11-02T10:00:00Z", [draft])),
      ...(await logWorkout(user.id, "2026-11-03T10:00:00Z", [
        { ...draft, addedWeight: 25.35, addedWeightNote: "dip belt" },
      ])),
      ...(await logWorkout(user.id, "2026-11-04T10:00:00Z", [
        { ...draft, addedWeight: -20.15, addedWeightNote: "red band" },
      ])),
    ];

    const { days } = expectOk(await progression.getMetrics(db, user.id, pullUp.id, "UTC"));

    expect(days.map((day) => day.maxWeight)).toEqual(sets.map((set) => set.load));
    expect(days.map((day) => day.maxWeight)).toEqual([172.45, 197.8, 152.3]);
  });

  test("is empty for a Movement with no Completed Sets", async () => {
    const user = await createUser(db);
    const bench = await createMovement(db, user.id);

    expect(await progression.getMetrics(db, user.id, bench.id, "UTC")).toEqual({ ok: true, days: [] });
  });

  test("returns movement-not-found for another user's Movement, the same as for one that doesn't exist", async () => {
    const owner = await createUser(db);
    const otherUser = await createUser(db);
    const bench = await createMovement(db, owner.id);
    await logWorkout(owner.id, "2026-11-03T10:00:00Z", [{ movementId: bench.id, reps: 5, weight: 100 }]);

    const forOthersMovement = await progression.getMetrics(db, otherUser.id, bench.id, "UTC");

    expect(forOthersMovement).toEqual({ ok: false, reason: "movement-not-found" });
    expect(forOthersMovement).toEqual(await progression.getMetrics(db, otherUser.id, crypto.randomUUID(), "UTC"));
  });

  // Postgres only reads the zone for a row, so without a Completed Set the answer is no days at all.
  test("returns invalid-time-zone for a zone Postgres doesn't know", async () => {
    const user = await createUser(db);
    const bench = await createMovement(db, user.id);
    await logWorkout(user.id, "2026-11-03T10:00:00Z", [{ movementId: bench.id, reps: 5, weight: 100 }]);

    expect(await progression.getMetrics(db, user.id, bench.id, "Mars/Olympus")).toEqual({
      ok: false,
      reason: "invalid-time-zone",
    });
  });
});

describe("listMovements", () => {
  test("lists only Movements with a Completed Set in a Completed Workout", async () => {
    const user = await createUser(db);
    const bench = await createMovement(db, user.id, { name: "Bench Press" });
    const plannedOnly = await createMovement(db, user.id, { name: "Squat" });
    const currentOnly = await createMovement(db, user.id, { name: "Deadlift" });
    await createMovement(db, user.id, { name: "Row" });
    await logWorkout(user.id, "2026-11-03T10:00:00Z", [
      { movementId: bench.id, reps: 5, weight: 100 },
      { movementId: plannedOnly.id, reps: 5, weight: 225, planned: 1 },
    ]);
    expectOk(await workouts.start(db, user.id));
    expectOk(await workouts.addSet(db, user.id, { movementId: currentOnly.id, reps: 5, weight: 315 }, "UTC"));

    const { movements } = expectOk(await progression.listMovements(db, user.id, "UTC"));

    expect(movements).toEqual([{ id: bench.id, name: bench.name, isBodyWeight: false, trainingDays: 1 }]);
  });

  test("sorts them by name, ignoring case", async () => {
    const user = await createUser(db);
    const named = await Promise.all(
      ["curl", "Arnold Press", "bench press"].map((name) => createMovement(db, user.id, { name })),
    );
    await logWorkout(
      user.id,
      "2026-11-03T10:00:00Z",
      named.map((movement) => ({ movementId: movement.id, reps: 5, weight: 50 })),
    );

    const { movements } = expectOk(await progression.listMovements(db, user.id, "UTC"));

    expect(movements.map((movement) => movement.name.split(" ").slice(0, -1).join(" "))).toEqual([
      "Arnold Press",
      "bench press",
      "curl",
    ]);
  });

  test("counts Training Days in the user's time zone, with the body-weight flag", async () => {
    const user = await createUser(db);
    const pullUp = await createMovement(db, user.id, { name: "Pull-up", isBodyWeight: true });
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-01", weight: 172.4 }, "UTC"));
    // 23:00 on Nov 6 in São Paulo, then the afternoon of Nov 7: two days there, one in UTC.
    await logWorkout(user.id, "2026-11-07T02:00:00Z", [{ movementId: pullUp.id, reps: 5, weight: 0 }]);
    await logWorkout(user.id, "2026-11-07T15:00:00Z", [{ movementId: pullUp.id, reps: 5, weight: 0 }]);

    const inSaoPaulo = expectOk(await progression.listMovements(db, user.id, saoPaulo));
    const inUtc = expectOk(await progression.listMovements(db, user.id, "UTC"));

    expect(inSaoPaulo.movements).toEqual([{ id: pullUp.id, name: pullUp.name, isBodyWeight: true, trainingDays: 2 }]);
    expect(inUtc.movements.map((movement) => movement.trainingDays)).toEqual([1]);
  });

  test("never lists another user's Movements", async () => {
    const owner = await createUser(db);
    const otherUser = await createUser(db);
    const bench = await createMovement(db, owner.id);
    await logWorkout(owner.id, "2026-11-03T10:00:00Z", [{ movementId: bench.id, reps: 5, weight: 100 }]);

    expect(await progression.listMovements(db, otherUser.id, "UTC")).toEqual({ ok: true, movements: [] });
  });

  test("returns invalid-time-zone for a zone Postgres doesn't know", async () => {
    const user = await createUser(db);
    const bench = await createMovement(db, user.id);
    await logWorkout(user.id, "2026-11-03T10:00:00Z", [{ movementId: bench.id, reps: 5, weight: 100 }]);

    expect(await progression.listMovements(db, user.id, "Mars/Olympus")).toEqual({
      ok: false,
      reason: "invalid-time-zone",
    });
  });
});
