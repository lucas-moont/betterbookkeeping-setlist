import { beforeAll, describe, expect, test } from "vitest";
import type { PrismaClient } from "../../../prisma/generated/client/client";
import { fixedId as id, migrationTestDatabase } from "./migration-test-database";

// Proves that the migration behind ADR 0006 leaves every user with at most one Current Workout
// without losing a Set, and only touches users who had more than one. Uses the shared
// migration-test harness.

const migration = migrationTestDatabase("one_current_workout");
let db: PrismaClient;

const movement = id(100);
const completedAt = new Date("2026-03-14T18:30:00.000Z");
let migratedAfter: Date;
let setsBefore: number;

// One user per case, each with the workouts the migration has to sort out.
const emptyAndWithSets = { user: id(1), empty: id(20), withSets: id(21) };
// The one with more Sets has the higher id, so only the Set count can keep it.
const moreAndFewerSets = { user: id(2), fewer: id(22), more: id(23) };
const twoEmpty = { user: id(3), lowerId: id(24), higherId: id(25) };
const oneEmpty = { user: id(4), only: id(26) };
const alreadyFine = { user: id(5), completedEmpty: id(27), completed: id(28), current: id(29) };
const sameSetCount = { user: id(6), lowerId: id(30), higherId: id(31) };

const users = [emptyAndWithSets, moreAndFewerSets, twoEmpty, oneEmpty, alreadyFine, sameSetCount].map((c) => c.user);

let setNumber = 200;
function sets(workoutId: string, count: number) {
  return Array.from({ length: count }, () => [id(setNumber++), workoutId] as const);
}

beforeAll(async () => {
  db = migration.db;

  for (const user of users) {
    await db.$executeRaw`INSERT INTO "User" (id, email, password, "updatedAt") VALUES
      (${user}, ${`${user}@example.com`}, 'hash', now())`;
  }
  // Movements belong to a user (ADR 0001); one Movement is enough for every Set here.
  await db.$executeRaw`INSERT INTO "Movement" (id, "userId", name, "nameKey") VALUES
    (${movement}, ${emptyAndWithSets.user}, 'Bench Press', 'bench press')`;

  const workouts: [string, string, Date | null][] = [
    [emptyAndWithSets.empty, emptyAndWithSets.user, null],
    [emptyAndWithSets.withSets, emptyAndWithSets.user, null],
    [moreAndFewerSets.more, moreAndFewerSets.user, null],
    [moreAndFewerSets.fewer, moreAndFewerSets.user, null],
    [twoEmpty.lowerId, twoEmpty.user, null],
    [twoEmpty.higherId, twoEmpty.user, null],
    [oneEmpty.only, oneEmpty.user, null],
    [alreadyFine.completedEmpty, alreadyFine.user, completedAt],
    [alreadyFine.completed, alreadyFine.user, completedAt],
    [alreadyFine.current, alreadyFine.user, null],
    [sameSetCount.lowerId, sameSetCount.user, null],
    [sameSetCount.higherId, sameSetCount.user, null],
  ];
  for (const [workoutId, userId, workoutCompletedAt] of workouts) {
    await db.$executeRaw`INSERT INTO "Workout" (id, "userId", "completedAt") VALUES
      (${workoutId}, ${userId}, ${workoutCompletedAt})`;
  }

  const allSets = [
    ...sets(emptyAndWithSets.withSets, 2),
    ...sets(moreAndFewerSets.more, 3),
    ...sets(moreAndFewerSets.fewer, 1),
    ...sets(alreadyFine.completed, 1),
    ...sets(alreadyFine.current, 1),
    ...sets(sameSetCount.lowerId, 1),
    ...sets(sameSetCount.higherId, 1),
  ];
  for (const [setId, workoutId] of allSets) {
    await db.$executeRaw`INSERT INTO "Set" (id, "workoutId", "movementId", reps, weight, "completedAt") VALUES
      (${setId}, ${workoutId}, ${movement}, 5, 135, now())`;
  }
  setsBefore = allSets.length;

  // The database's clock, not this process's: in Docker Desktop the two can drift apart.
  [{ now: migratedAfter }] = await db.$queryRaw<{ now: Date }[]>`SELECT now()`;
  migration.applyTarget();
}, 60_000);

async function workoutsOf(userId: string) {
  return db.$queryRaw<{ id: string; completedAt: Date | null; startedAt: Date | null }[]>`
    SELECT id, "completedAt", "startedAt" FROM "Workout" WHERE "userId" = ${userId} ORDER BY id`;
}

async function currentWorkoutIds(userId: string) {
  return (await workoutsOf(userId)).filter((w) => w.completedAt === null).map((w) => w.id);
}

async function completedAtOf(workoutId: string) {
  const [row] = await db.$queryRaw<{ completedAt: Date | null }[]>`
    SELECT "completedAt" FROM "Workout" WHERE id = ${workoutId}`;
  return row?.completedAt;
}

describe("a user with more than one Current Workout", () => {
  test("keeps the one with Sets, and the empty one is deleted", async () => {
    expect(await workoutsOf(emptyAndWithSets.user)).toEqual([
      { id: emptyAndWithSets.withSets, completedAt: null, startedAt: null },
    ]);
  });

  test("keeps the one with the most Sets open, and the other is completed at the migration time", async () => {
    expect(await currentWorkoutIds(moreAndFewerSets.user)).toEqual([moreAndFewerSets.more]);
    const fewerCompletedAt = await completedAtOf(moreAndFewerSets.fewer);
    expect(fewerCompletedAt!.getTime()).toBeGreaterThanOrEqual(migratedAfter.getTime());
  });

  test("with two empty ones keeps the lower id open, and the other is deleted", async () => {
    expect(await workoutsOf(twoEmpty.user)).toEqual([{ id: twoEmpty.lowerId, completedAt: null, startedAt: null }]);
  });

  test("with the same number of Sets keeps the lower id open, and completes the other", async () => {
    expect(await currentWorkoutIds(sameSetCount.user)).toEqual([sameSetCount.lowerId]);
    const higherCompletedAt = await completedAtOf(sameSetCount.higherId);
    expect(higherCompletedAt!.getTime()).toBeGreaterThanOrEqual(migratedAfter.getTime());
  });
});

describe("a user with at most one Current Workout", () => {
  test("keeps an empty one: it is the user's to complete or discard", async () => {
    expect(await workoutsOf(oneEmpty.user)).toEqual([{ id: oneEmpty.only, completedAt: null, startedAt: null }]);
  });

  test("keeps every workout as it was, Completed ones with no Sets included", async () => {
    expect(await workoutsOf(alreadyFine.user)).toEqual([
      { id: alreadyFine.completedEmpty, completedAt, startedAt: null },
      { id: alreadyFine.completed, completedAt, startedAt: null },
      { id: alreadyFine.current, completedAt: null, startedAt: null },
    ]);
  });
});

test("no Set is lost", async () => {
  const [{ count }] = await db.$queryRaw<{ count: number }[]>`SELECT count(*)::int AS count FROM "Set"`;

  expect(count).toBe(setsBefore);
});

test("a second Current Workout for the same user is refused", async () => {
  await expect(
    db.$executeRaw`INSERT INTO "Workout" (id, "userId") VALUES (${id(900)}, ${oneEmpty.user})`,
  ).rejects.toThrow(/Workout_one_current_per_user/);
  // A Completed Workout is not a Current Workout, so the index lets it in.
  await db.$executeRaw`INSERT INTO "Workout" (id, "userId", "completedAt") VALUES
    (${id(901)}, ${oneEmpty.user}, now())`;
  expect(await currentWorkoutIds(oneEmpty.user)).toEqual([oneEmpty.only]);
});
