import { beforeAll, describe, expect, test } from "vitest";
import type { PrismaClient } from "../../../prisma/generated/client/client";
import { fixedId as id, migrationTestDatabase } from "./migration-test-database";

// Proves that the migration behind ADR 0003's body-weight Sets leaves every existing Set as it was
// logged, and that its CHECK constraints, the first in the repo, refuse what the module never writes.
// Uses the shared migration-test harness.

const migration = migrationTestDatabase("set_body_weight_and_added_weight");
let db: PrismaClient;

const user = id(1);
const barbell = id(10);
const pullUp = id(11);
const workout = id(20);
const barbellSet = id(30);
// Logged before Sets took a Body Weight Snapshot, on a Movement already flagged body-weight: its
// weight is whatever the lifter typed, so it must not start reading as a snapshot.
const pullUpSet = id(31);

beforeAll(async () => {
  db = migration.db;

  await db.$executeRaw`INSERT INTO "User" (id, email, password, "updatedAt") VALUES
    (${user}, 'lifter@example.com', 'hash', now())`;
  await db.$executeRaw`INSERT INTO "Movement" (id, "userId", name, "nameKey", "isBodyWeight") VALUES
    (${barbell}, ${user}, 'Bench Press', 'bench press', false),
    (${pullUp}, ${user}, 'Pull-up', 'pull-up', true)`;
  await db.$executeRaw`INSERT INTO "Workout" (id, "userId") VALUES (${workout}, ${user})`;
  await db.$executeRaw`INSERT INTO "Set" (id, "workoutId", "movementId", reps, weight, "completedAt") VALUES
    (${barbellSet}, ${workout}, ${barbell}, 5, 185, now()),
    (${pullUpSet}, ${workout}, ${pullUp}, 8, 0, now())`;

  migration.applyTarget();
}, 60_000);

let nextSet = 100;

/** Inserts one Set of the Workout with the new columns, returning the promise so a test can expect it to fail. */
function insertSet(columns: {
  weight: number;
  isBodyWeight: boolean;
  addedWeight: number | null;
  note: string | null;
}) {
  return db.$executeRaw`INSERT INTO "Set"
    (id, "workoutId", "movementId", reps, weight, "isBodyWeight", "addedWeight", "addedWeightNote") VALUES
    (${id(nextSet++)}, ${workout}, ${pullUp}, 5, ${columns.weight}, ${columns.isBodyWeight},
     ${columns.addedWeight}, ${columns.note})`;
}

test("keeps every existing Set as it was logged: not body-weight, no Added Weight", async () => {
  const sets = await db.$queryRaw<
    { id: string; weight: number; isBodyWeight: boolean; addedWeight: number | null; addedWeightNote: string | null }[]
  >`SELECT id, weight::float8 AS weight, "isBodyWeight", "addedWeight"::float8 AS "addedWeight", "addedWeightNote"
    FROM "Set" WHERE id IN (${barbellSet}, ${pullUpSet}) ORDER BY id`;

  expect(sets).toEqual([
    { id: barbellSet, weight: 185, isBodyWeight: false, addedWeight: null, addedWeightNote: null },
    { id: pullUpSet, weight: 0, isBodyWeight: false, addedWeight: null, addedWeightNote: null },
  ]);
});

describe("the CHECK constraints", () => {
  test("accept a body-weight Set with Added Weight and its note, and one with neither", async () => {
    await insertSet({ weight: 172.4, isBodyWeight: true, addedWeight: 25, note: "dip belt" });
    await insertSet({ weight: 172.4, isBodyWeight: true, addedWeight: null, note: null });
  });

  test("refuse Added Weight without a note, and a note without Added Weight", async () => {
    await expect(insertSet({ weight: 172.4, isBodyWeight: true, addedWeight: 25, note: null })).rejects.toThrow(
      /Set_addedWeight_with_note/,
    );
    await expect(insertSet({ weight: 172.4, isBodyWeight: true, addedWeight: null, note: "dip belt" })).rejects.toThrow(
      /Set_addedWeight_with_note/,
    );
  });

  test("refuse assistance above the weight, so Load is never negative, and accept it up to the weight", async () => {
    await expect(
      insertSet({ weight: 172.4, isBodyWeight: true, addedWeight: -172.41, note: "assisted machine" }),
    ).rejects.toThrow(/Set_load_not_negative/);
    await insertSet({ weight: 172.4, isBodyWeight: true, addedWeight: -172.4, note: "assisted machine" });
  });

  test("refuse Added Weight on a Set that isn't body-weight", async () => {
    await expect(insertSet({ weight: 135, isBodyWeight: false, addedWeight: 10, note: "chains" })).rejects.toThrow(
      /Set_addedWeight_only_on_body_weight/,
    );
  });

  test("refuse a note longer than 60 characters", async () => {
    await expect(
      insertSet({ weight: 172.4, isBodyWeight: true, addedWeight: 10, note: "x".repeat(61) }),
    ).rejects.toThrow(/too long/);
  });
});
