import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { migrationSqlPath } from "@/test/migrations/migration-folders";
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
  // drifted apart, a migrated movement and a new one with the same name could both exist. The
  // test runs the functions from the migration file itself, so it checks what the migration runs.
  test("gives the same key as the SQL in the migration", async () => {
    const db = await getServerSidePrismaClient();
    const names = [
      "Bench Press",
      "  Back Squat  ",
      "\tPull-up\n",
      "\r\fDips\v",
      "Overhead  Press",
      // No-break and other Unicode spaces, as pasted from a web page or a phone keyboard.
      `${String.fromCharCode(0xa0)}Sumo Deadlift${String.fromCharCode(0xa0)}`,
      `${String.fromCharCode(0x2003, 0x3000)}Front Squat${String.fromCharCode(0xfeff, 0x202f)}`,
      `Hip${String.fromCharCode(0xa0)}Thrust`,
      // Not whitespace for JavaScript, so it stays in the key, in SQL too.
      `${String.fromCharCode(0x85)}Lunge${String.fromCharCode(0x180e)}`,
      // Letters whose lower case differs between libc and the Unicode rules JavaScript follows.
      "ÉLÉVATION LATÉRALE",
      "ELEVAÇÃO PÉLVICA",
      "ΚΑΘΙΣΜΑΤΑ ΜΕ ΑΛΤΗΡΕΣ",
      "İNCLINE PRESS",
      "KREUZHEBEN MIT GROẞER LAST",
    ];

    // pg_temp functions live in one connection, so the test pins one with a transaction.
    const keys = await db.$transaction(async (tx) => {
      for (const statement of migrationNameFunctions()) await tx.$executeRawUnsafe(statement);
      const rows = [];
      for (const name of names) {
        const [{ key }] = await tx.$queryRaw<{ key: string }[]>`SELECT pg_temp.name_key(${name}) AS key`;
        rows.push(key);
      }
      return rows;
    });

    expect(keys).toEqual(names.map(movementNameKey));
  });
});

/** The CREATE FUNCTION statements of the movements_owned_by_user migration. */
function migrationNameFunctions() {
  const sql = readFileSync(migrationSqlPath("movements_owned_by_user"), "utf8");
  const statements = sql.match(/CREATE FUNCTION pg_temp\.[\s\S]*?\$\$;/g) ?? [];
  if (statements.length !== 2) throw new Error(`Expected 2 pg_temp functions, found ${statements.length}`);
  return statements;
}
