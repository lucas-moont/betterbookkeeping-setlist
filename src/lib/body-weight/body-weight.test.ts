import { afterEach, describe, expect, test, vi } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { expectOk } from "@/test/expect-ok";
import { createMovement, createUser } from "@/test/factories";
import * as bodyWeight from "@/lib/body-weight";
import * as workouts from "@/lib/workouts";

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

describe("latest", () => {
  test("is the entry with the most recent date, not the one recorded last", async () => {
    const user = await createUser(db);
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-03", weight: 172.4 }, "UTC"));
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-10-20", weight: 175 }, "UTC"));

    expect(await bodyWeight.latest(db, user.id)).toEqual({ date: "2026-11-03", weight: 172.4 });
  });

  test("is null for a user with no entries, even when another user has some", async () => {
    const user = await createUser(db);
    const otherUser = await createUser(db);
    expectOk(await bodyWeight.record(db, otherUser.id, { date: "2026-11-03", weight: 150 }, "UTC"));

    expect(await bodyWeight.latest(db, user.id)).toBeNull();
  });
});

describe("remove", () => {
  test("deletes the entry for the date and leaves the others", async () => {
    const user = await createUser(db);
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-03", weight: 172.4 }, "UTC"));
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-10-20", weight: 175 }, "UTC"));

    expectOk(await bodyWeight.remove(db, user.id, "2026-11-03"));

    expect(await bodyWeight.list(db, user.id)).toEqual([{ date: "2026-10-20", weight: 175 }]);
  });

  test("returns body-weight-entry-not-found for a date with no entry", async () => {
    const user = await createUser(db);

    expect(await bodyWeight.remove(db, user.id, "2026-11-03")).toEqual({
      ok: false,
      reason: "body-weight-entry-not-found",
    });
  });

  test("returns body-weight-entry-not-found for another user's entry, and keeps it", async () => {
    const user = await createUser(db);
    const otherUser = await createUser(db);
    expectOk(await bodyWeight.record(db, otherUser.id, { date: "2026-11-03", weight: 150 }, "UTC"));

    expect(await bodyWeight.remove(db, user.id, "2026-11-03")).toEqual({
      ok: false,
      reason: "body-weight-entry-not-found",
    });

    expect(await bodyWeight.list(db, otherUser.id)).toEqual([{ date: "2026-11-03", weight: 150 }]);
  });

  // A Completed Set keeps the Body Weight Snapshot it copied (ADR 0003), so deleting an entry
  // rewrites no history. The form's weight differs from the entry, so only the snapshot can give 172.4.
  test("leaves a Completed Set with that body weight unchanged", async () => {
    const user = await createUser(db);
    const movement = await createMovement(db, user.id, { name: "Pull-up", isBodyWeight: true });
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-03", weight: 172.4 }, "UTC"));
    expectOk(await workouts.start(db, user.id));
    expectOk(await workouts.addSet(db, user.id, { movementId: movement.id, reps: 8, weight: 0 }, "UTC"));

    expectOk(await bodyWeight.remove(db, user.id, "2026-11-03"));

    const workout = await workouts.get(db, user.id);
    expect(workout?.sets.map((set) => ({ reps: set.reps, weight: set.weight }))).toEqual([{ reps: 8, weight: 172.4 }]);
  });
});
