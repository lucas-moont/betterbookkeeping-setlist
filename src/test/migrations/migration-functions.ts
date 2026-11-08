import { readFileSync } from "node:fs";
import type { PrismaClient } from "../../../prisma/generated/client/client";
import { migrationSqlPath } from "./migration-folders";

// For the SQL x JS parity tests: a migration that rewrites stored text in SQL must agree with the
// code that writes and looks it up afterwards. These run the migration's own functions, from its
// file, so a test checks what the migration runs.

/**
 * Creates every `pg_temp` function of the migration and returns what `functionName` gives for
 * each input, in order, from a single query.
 */
export async function runMigrationFunction(
  db: PrismaClient,
  migrationName: string,
  functionName: string,
  inputs: string[],
): Promise<string[]> {
  // The name goes into the SQL text, so it can only be a plain identifier.
  if (!/^[a-z_]+$/.test(functionName)) throw new Error(`Not a function name: ${functionName}`);
  const statements =
    readFileSync(migrationSqlPath(migrationName), "utf8").match(/CREATE FUNCTION pg_temp\.[\s\S]*?\$\$;/g) ?? [];
  if (!statements.some((statement) => statement.startsWith(`CREATE FUNCTION pg_temp.${functionName}(`))) {
    throw new Error(`The ${migrationName} migration has no pg_temp.${functionName}`);
  }

  // pg_temp functions live in one connection, so a transaction pins one.
  return db.$transaction(async (tx) => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
    const rows = await tx.$queryRawUnsafe<{ output: string }[]>(
      `SELECT pg_temp.${functionName}(input) AS output
       FROM unnest($1::text[]) WITH ORDINALITY AS t(input, position)
       ORDER BY position`,
      inputs,
    );
    return rows.map((row) => row.output);
  });
}

const char = (...codes: number[]) => String.fromCharCode(...codes);

/**
 * Text where SQL and JavaScript are easy to get apart: whitespace that JavaScript's trim() strips
 * and Postgres' trim() or \s don't (and the reverse), and letters whose lower case differs between
 * libc and the Unicode rules JavaScript follows.
 */
export const whitespaceAndCaseInputs = [
  "  Back Squat  ",
  "\tPull-up\n",
  "\r\fDips\v",
  // No-break and other Unicode spaces, as pasted from a web page or a phone keyboard.
  `${char(0xa0)}Sumo Deadlift${char(0xa0)}`,
  `${char(0x2003, 0x3000)}Front Squat${char(0xfeff, 0x202f)}`,
  `Hip${char(0xa0)}Thrust`,
  // Not whitespace for JavaScript, so it stays, in SQL too.
  `${char(0x85)}Lunge${char(0x180e)}`,
  "ÉLÉVATION LATÉRALE",
  "ELEVAÇÃO PÉLVICA",
  "ΚΑΘΙΣΜΑΤΑ ΜΕ ΑΛΤΗΡΕΣ",
  "İNCLINE PRESS",
  "KREUZHEBEN MIT GROẞER LAST",
];
