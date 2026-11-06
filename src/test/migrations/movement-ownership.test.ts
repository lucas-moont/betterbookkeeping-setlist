import { execSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../prisma/generated/client/client";
import { testDatabaseUrl } from "../test-database-url";
import { migrationFolders, migrationSqlPath, migrationsDir } from "./migration-folders";

// The one migration test (ADR 0001): proves that giving every Movement an owner loses no Set.
// It builds a throwaway database at the schema right before the migration, fills it with the
// cases the migration has to handle, applies only that migration, and checks the result.

const targetSql = migrationSqlPath("movements_owned_by_user");
const targetFolder = path.basename(path.dirname(targetSql));
const sqlBefore = migrationFolders()
  .filter((folder) => folder < targetFolder)
  .map((folder) => path.join(migrationsDir, folder, "migration.sql"));

const databaseName = `setlist_migration_${crypto.randomUUID().replaceAll("-", "")}_test`;
const databaseUrl = Object.assign(new URL(testDatabaseUrl), { pathname: `/${databaseName}` }).toString();

// The admin client only creates and drops the throwaway database.
const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) });
let db: PrismaClient;

function applyMigration(sqlPath: string) {
  execSync(`bunx prisma db execute --file "${sqlPath}"`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
}

// Fixed ids, so the expected outcome below doesn't depend on random values.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const alice = id(1);
const bob = id(2);
const movement = {
  benchPress: id(10), // used by both users
  benchPressLower: id(11), // Alice's case-duplicate, with fewer sets
  deadliftUpper: id(12), // Bob's case-duplicates tie on sets: the lower id wins
  deadlift: id(13),
  squatWithSpaces: id(14), // spaces around the name
  unused: id(15), // nobody logged a set with it
};

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  for (const sqlPath of sqlBefore) applyMigration(sqlPath);
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  await db.$executeRaw`INSERT INTO "User" (id, email, password, "updatedAt") VALUES
    (${alice}, 'alice@example.com', 'hash', now()), (${bob}, 'bob@example.com', 'hash', now())`;
  await db.$executeRaw`INSERT INTO "Workout" (id, "userId", "completedAt") VALUES
    (${id(20)}, ${alice}, now()), (${id(21)}, ${alice}, NULL), (${id(22)}, ${bob}, now())`;
  await db.$executeRaw`INSERT INTO "Movement" (id, name) VALUES
    (${movement.benchPress}, 'Bench Press'), (${movement.benchPressLower}, 'bench press'),
    (${movement.deadliftUpper}, 'DEADLIFT'), (${movement.deadlift}, 'Deadlift'),
    (${movement.squatWithSpaces}, '  Squat  '), (${movement.unused}, 'Unused')`;
  await db.$executeRaw`INSERT INTO "Set" (id, "workoutId", "movementId", reps, weight) VALUES
    (${id(30)}, ${id(20)}, ${movement.benchPress}, 5, 185),
    (${id(31)}, ${id(21)}, ${movement.benchPress}, 5, 190),
    (${id(32)}, ${id(21)}, ${movement.benchPressLower}, 8, 135),
    (${id(33)}, ${id(22)}, ${movement.benchPress}, 3, 225),
    (${id(34)}, ${id(22)}, ${movement.deadliftUpper}, 5, 315),
    (${id(35)}, ${id(22)}, ${movement.deadlift}, 3, 335),
    (${id(36)}, ${id(22)}, ${movement.squatWithSpaces}, 5, 275)`;

  applyMigration(targetSql);
}, 60_000);

afterAll(async () => {
  await db?.$disconnect();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.$disconnect();
});

test("keeps every Set, with the same workout, reps and weight", async () => {
  const sets = await db.$queryRaw<{ id: string; workoutId: string; reps: number; weight: number }[]>`
    SELECT id, "workoutId", reps, weight FROM "Set" ORDER BY id`;

  expect(sets).toEqual([
    { id: id(30), workoutId: id(20), reps: 5, weight: 185 },
    { id: id(31), workoutId: id(21), reps: 5, weight: 190 },
    { id: id(32), workoutId: id(21), reps: 8, weight: 135 },
    { id: id(33), workoutId: id(22), reps: 3, weight: 225 },
    { id: id(34), workoutId: id(22), reps: 5, weight: 315 },
    { id: id(35), workoutId: id(22), reps: 3, weight: 335 },
    { id: id(36), workoutId: id(22), reps: 5, weight: 275 },
  ]);
});

test("every Set points at a Movement owned by the user who logged it", async () => {
  const [{ mismatched }] = await db.$queryRaw<{ mismatched: number }[]>`
    SELECT count(*)::int AS mismatched FROM "Set" s
    JOIN "Workout" w ON w.id = s."workoutId"
    JOIN "Movement" m ON m.id = s."movementId"
    WHERE m."userId" <> w."userId"`;

  expect(mismatched).toBe(0);
});

test("gives each user one Movement per name, merging case-duplicates into the one with the most Sets", async () => {
  const movements = await db.$queryRaw<{ userId: string; name: string; nameKey: string; sets: number }[]>`
    SELECT m."userId", m.name, m."nameKey", count(s.id)::int AS sets FROM "Movement" m
    LEFT JOIN "Set" s ON s."movementId" = m.id
    GROUP BY m.id ORDER BY m."userId", m."nameKey"`;

  expect(movements).toEqual([
    { userId: alice, name: "Bench Press", nameKey: "bench press", sets: 3 },
    { userId: bob, name: "Bench Press", nameKey: "bench press", sets: 1 },
    { userId: bob, name: "DEADLIFT", nameKey: "deadlift", sets: 2 },
    { userId: bob, name: "Squat", nameKey: "squat", sets: 1 },
  ]);
});

test("drops the shared Movements, including the one nobody used", async () => {
  const [{ left }] = await db.$queryRaw<{ left: number }[]>`
    SELECT count(*)::int AS left FROM "Movement" WHERE id = ANY(${Object.values(movement)})`;

  expect(left).toBe(0);
});

test("makes the owner and the name key required", async () => {
  await expect(db.$executeRaw`INSERT INTO "Movement" (id, name) VALUES (${id(40)}, 'No owner')`).rejects.toThrow();
  await expect(
    db.$executeRaw`INSERT INTO "Movement" (id, "userId", name, "nameKey") VALUES (${id(41)}, ${alice}, 'BENCH PRESS', 'bench press')`,
  ).rejects.toThrow();
});
