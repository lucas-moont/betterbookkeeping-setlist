import type { DbClient } from "@/lib/db.server";

/**
 * Every foreign key in the public schema that no index covers, as "Table(column, ...)", sorted.
 *
 * An index covers a foreign key when the key's columns are its leading columns, in any order within
 * that prefix: a B-tree can only be searched from its first column, so a unique on (userId, nameKey)
 * serves a lookup by userId, and one on (nameKey, userId) wouldn't. A partial index doesn't count,
 * since it only holds some rows (the one of ADR 0006 holds only Current Workouts).
 *
 * It reads indexes the way Prisma writes them. An index that failed to build (only possible with
 * CREATE INDEX CONCURRENTLY) or an INCLUDE column would still count as cover; no migration here
 * makes either.
 */
export async function unindexedForeignKeys(db: DbClient): Promise<string[]> {
  const rows = await db.$queryRaw<{ key: string }[]>`
    SELECT format('%s(%s)', t.relname, (
      SELECT string_agg(a.attname, ', ' ORDER BY k.ord)
      FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    )) AS key
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype = 'f'
      AND c.connamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND i.indpred IS NULL
          -- indkey as an array starts at 0, so [0:n - 1] is the index's first n columns. Holding all
          -- n columns of the key means holding exactly those, in any order.
          AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
      )
    ORDER BY key`;
  return rows.map((row) => row.key);
}
