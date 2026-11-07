import { beforeAll, describe, expect, test } from "vitest";
import { unindexedForeignKeys } from "../foreign-key-indexes";
import { migrationTestDatabase } from "./migration-test-database";

// Proves the foreign-key index check on a throwaway database at the schema right before the
// workout_user_completed_index migration, when Workout(userId) was the one foreign key without an
// index. Uses the shared migration-test harness.

const migration = migrationTestDatabase("workout_user_completed_index");

let beforeMigration: string[];
let withPartialIndex: string[];
let afterMigration: string[];

beforeAll(async () => {
  const db = migration.db;
  beforeMigration = await unindexedForeignKeys(db);

  // ADR 0006's index, as the later one_current_workout migration creates it. It only holds Current
  // Workouts.
  await db.$executeRaw`CREATE UNIQUE INDEX "Workout_one_current_per_user" ON "Workout"("userId") WHERE "completedAt" IS NULL`;
  withPartialIndex = await unindexedForeignKeys(db);

  migration.applyTarget();
  afterMigration = await unindexedForeignKeys(db);
}, 60_000);

describe("foreign keys without an index", () => {
  test("finds Workout(userId) before its index, and counts Movement's unique on (userId, nameKey)", () => {
    expect(beforeMigration).toEqual(["Workout(userId)"]);
  });

  test("doesn't count a partial index, which only holds some of the rows", () => {
    expect(withPartialIndex).toEqual(["Workout(userId)"]);
  });

  test("finds none once the migration adds the (userId, completedAt) index", () => {
    expect(afterMigration).toEqual([]);
  });
});
