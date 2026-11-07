import { afterEach, describe, expect, test, vi } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { expectOk } from "@/test/expect-ok";
import { createUser } from "@/test/factories";
import * as bodyWeight from "@/lib/body-weight";

// The body-weight module tested through its interface against the real test database (ADR 0008).
// Every test creates its own users, so the dates they record never clash with other tests.
const db = await getServerSidePrismaClient();

const saoPaulo = "America/Sao_Paulo";

afterEach(() => {
  vi.useRealTimers();
});

/** Freezes the clock (only Date, so the database driver's timers keep running). */
function setNow(instant: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(instant));
}

describe("record", () => {
  test("adds an entry that list returns, with the date as text and the weight as a number", async () => {
    const user = await createUser(db);

    const { entry } = expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-02", weight: 172.4 }, "UTC"));

    expect(entry).toEqual({ date: "2026-11-02", weight: 172.4 });
    expect(await bodyWeight.list(db, user.id)).toEqual([{ date: "2026-11-02", weight: 172.4 }]);
  });

  test("replaces the weight when the date already has an entry, keeping one entry", async () => {
    const user = await createUser(db);
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-02", weight: 172.4 }, "UTC"));

    const { entry } = expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-02", weight: 171.85 }, "UTC"));

    expect(entry).toEqual({ date: "2026-11-02", weight: 171.85 });
    expect(await bodyWeight.list(db, user.id)).toEqual([{ date: "2026-11-02", weight: 171.85 }]);
  });

  test("keeps each user's entries apart, even on the same date", async () => {
    const user = await createUser(db);
    const otherUser = await createUser(db);
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-02", weight: 172.4 }, "UTC"));

    expectOk(await bodyWeight.record(db, otherUser.id, { date: "2026-11-02", weight: 150 }, "UTC"));

    expect(await bodyWeight.list(db, user.id)).toEqual([{ date: "2026-11-02", weight: 172.4 }]);
    expect(await bodyWeight.list(db, otherUser.id)).toEqual([{ date: "2026-11-02", weight: 150 }]);
  });

  test("accepts today in the user's zone when UTC is already on the next day", async () => {
    // 22:00 on Nov 6 in São Paulo is 01:00 on Nov 7 in UTC.
    setNow("2026-11-07T01:00:00Z");
    const user = await createUser(db);

    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-06", weight: 172.4 }, saoPaulo));

    expect(await bodyWeight.list(db, user.id)).toEqual([{ date: "2026-11-06", weight: 172.4 }]);
  });

  test("refuses a date after the user's today, even when it is already today in UTC", async () => {
    setNow("2026-11-07T01:00:00Z");
    const user = await createUser(db);

    expect(await bodyWeight.record(db, user.id, { date: "2026-11-07", weight: 172.4 }, saoPaulo)).toEqual({
      ok: false,
      reason: "body-weight-date-in-future",
    });

    expect(await bodyWeight.list(db, user.id)).toEqual([]);
  });
});

describe("list", () => {
  test("returns the entries newest date first, whatever order they were recorded in", async () => {
    const user = await createUser(db);
    for (const date of ["2026-10-20", "2026-11-03", "2026-09-01"]) {
      expectOk(await bodyWeight.record(db, user.id, { date, weight: 170 }, "UTC"));
    }

    const dates = (await bodyWeight.list(db, user.id)).map((entry) => entry.date);

    expect(dates).toEqual(["2026-11-03", "2026-10-20", "2026-09-01"]);
  });
});
