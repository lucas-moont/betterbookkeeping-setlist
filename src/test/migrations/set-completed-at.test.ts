import { beforeAll, expect, test } from "vitest";
import type { PrismaClient } from "../../../prisma/generated/client/client";
import { fixedId as id, migrationTestDatabase } from "./migration-test-database";

// Proves that adding Set.completedAt turns no existing Set into a Planned Set (ADR 0011), with the
// shared migration-test harness.

const migration = migrationTestDatabase("set_completed_at");
let db: PrismaClient;

const user = id(1);
const movement = id(10);
const completedWorkout = id(20);
const openWorkout = id(21);
const workoutCompletedAt = new Date("2026-03-14T18:30:00.000Z");
let migratedAfter: Date;

beforeAll(async () => {
  db = migration.db;

  await db.$executeRaw`INSERT INTO "User" (id, email, password, "updatedAt") VALUES
    (${user}, 'lifter@example.com', 'hash', now())`;
  await db.$executeRaw`INSERT INTO "Movement" (id, "userId", name, "nameKey") VALUES
    (${movement}, ${user}, 'Bench Press', 'bench press')`;
  await db.$executeRaw`INSERT INTO "Workout" (id, "userId", "completedAt") VALUES
    (${completedWorkout}, ${user}, ${workoutCompletedAt}), (${openWorkout}, ${user}, NULL)`;
  await db.$executeRaw`INSERT INTO "Set" (id, "workoutId", "movementId", reps, weight) VALUES
    (${id(30)}, ${completedWorkout}, ${movement}, 5, 185),
    (${id(31)}, ${completedWorkout}, ${movement}, 5, 185),
    (${id(32)}, ${openWorkout}, ${movement}, 8, 135)`;

  // The database's clock, not this process's: in Docker Desktop the two can drift apart.
  [{ now: migratedAfter }] = await db.$queryRaw<{ now: Date }[]>`SELECT now()`;
  migration.applyTarget();
}, 60_000);

async function completedAtOf(setId: string) {
  const [row] = await db.$queryRaw<{ completedAt: Date | null }[]>`
    SELECT "completedAt" FROM "Set" WHERE id = ${setId}`;
  return row.completedAt;
}

test("a Set of a Completed Workout is completed when its Workout was", async () => {
  expect(await completedAtOf(id(30))).toEqual(workoutCompletedAt);
  expect(await completedAtOf(id(31))).toEqual(workoutCompletedAt);
});

test("a Set of a Workout still open is completed at the migration time", async () => {
  const completedAt = await completedAtOf(id(32));

  expect(completedAt).not.toBeNull();
  expect(completedAt!.getTime()).toBeGreaterThanOrEqual(migratedAfter.getTime());
});

test("no existing Set becomes a Planned Set", async () => {
  const [{ planned }] = await db.$queryRaw<{ planned: number }[]>`
    SELECT count(*)::int AS planned FROM "Set" WHERE "completedAt" IS NULL`;

  expect(planned).toBe(0);
});
