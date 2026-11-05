import { describe, expect, test } from "vitest";
import { createServerOnlyFn } from "@tanstack/react-start";
import { getServerSidePrismaClient } from "@/lib/db.server";
import type { PrismaClient } from "../../prisma/generated/client/client";

// Smoke test for the integration test harness (ADR 0008): a module function wrapped in
// createServerOnlyFn, shaped like the domain modules of ADR 0010, talking to the real test database.
// If the Vitest config, the @/ alias, the migrations or the connection break, this fails first.
const createUser = createServerOnlyFn(async (db: PrismaClient, email: string) =>
  db.user.create({ data: { email, password: "smoke-test" }, select: { id: true } }),
);

describe("integration test harness", () => {
  test("a server-only module function reads and writes the test database", async () => {
    const db = await getServerSidePrismaClient();
    const email = `smoke-${crypto.randomUUID()}@example.com`;

    const created = await createUser(db, email);
    const found = await db.user.findUnique({ where: { id: created.id }, select: { email: true } });

    expect(found).toEqual({ email });
  });
});
