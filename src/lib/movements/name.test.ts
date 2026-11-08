import { describe, expect, test } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { runMigrationFunction, whitespaceAndCaseInputs } from "@/test/migrations/migration-functions";
import { movementNameKey, movementNameSchema } from "./name";

describe("movementNameSchema", () => {
  test("takes the name without the whitespace around it", () => {
    expect(movementNameSchema.parse("  Front Squat	")).toBe("Front Squat");
  });

  test("refuses an empty name, or one that is only whitespace", () => {
    expect(movementNameSchema.safeParse("").success).toBe(false);
    expect(movementNameSchema.safeParse(" 	 ").success).toBe(false);
  });

  test("takes up to 100 characters", () => {
    expect(movementNameSchema.safeParse("a".repeat(100)).success).toBe(true);
    expect(movementNameSchema.safeParse("a".repeat(101)).success).toBe(false);
  });
});

describe("movementNameKey", () => {
  test("ignores case, so 'Bench Press' and 'bench press' are the same name", () => {
    expect(movementNameKey("Bench Press")).toBe("bench press");
    expect(movementNameKey("bench press")).toBe("bench press");
    expect(movementNameKey("BENCH PRESS")).toBe("bench press");
  });

  test("ignores whitespace around the name, but keeps it inside", () => {
    expect(movementNameKey("  Back Squat\t\n")).toBe("back squat");
    expect(movementNameKey("Back  Squat")).toBe("back  squat");
  });

  // The migration computes the same key in SQL for the existing movements (ADR 0001). If the two
  // drifted apart, a migrated movement and a new one with the same name could both exist.
  test("gives the same key as the SQL in the migration", async () => {
    const names = ["Bench Press", "Overhead  Press", ...whitespaceAndCaseInputs];

    const keys = await runMigrationFunction(
      await getServerSidePrismaClient(),
      "movements_owned_by_user",
      "name_key",
      names,
    );

    expect(keys).toEqual(names.map(movementNameKey));
  });
});
