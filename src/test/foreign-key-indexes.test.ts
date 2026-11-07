import { expect, test } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { unindexedForeignKeys } from "./foreign-key-indexes";

// Postgres and Prisma don't index foreign keys, so a missing one only shows up as a full table scan
// once the table is big. With every migration applied, a new table with a foreign key (sessions,
// login attempts) fails here until it gets an index. The check itself is proven in
// migrations/foreign-key-indexes.test.ts.
test("every foreign key has an index", async () => {
  expect(await unindexedForeignKeys(await getServerSidePrismaClient())).toEqual([]);
});
