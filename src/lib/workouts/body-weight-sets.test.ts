import { afterEach, describe, expect, test, vi } from "vitest";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { expectOk } from "@/test/expect-ok";
import { createMovement, createUser } from "@/test/factories";
import * as bodyWeight from "@/lib/body-weight";
import * as movements from "@/lib/movements";
import * as workouts from "@/lib/workouts";

// Sets of Body-weight Movements (ADR 0003, ADR 0011), tested through the workouts module against the
// real test database (ADR 0008). Body Weight Entries are recorded through the body-weight module, and
// every check reads back through workouts.get or workouts.history.
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

/** A user with a Current Workout and a Body-weight Movement, plus the given Body Weight Entries. */
async function lifterWithPullUps(entries: bodyWeight.BodyWeightEntry[] = []) {
  const user = await createUser(db);
  const pullUp = await createMovement(db, user.id, { name: "Pull-up", isBodyWeight: true });
  for (const entry of entries) expectOk(await bodyWeight.record(db, user.id, entry, "UTC"));
  expectOk(await workouts.start(db, user.id));
  return { user, pullUp };
}

describe("addSet on a Body-weight Movement", () => {
  test("copies the Latest Body Weight into the Set as its Weight, whatever weight the form sent", async () => {
    const { user, pullUp } = await lifterWithPullUps([
      { date: "2026-11-03", weight: 172.4 },
      { date: "2026-10-20", weight: 175 },
    ]);

    const { sets } = expectOk(
      await workouts.addSet(db, user.id, { movementId: pullUp.id, reps: 8, weight: 999, count: 2 }, "UTC"),
    );

    const snapshot = {
      id: expect.any(String),
      reps: 8,
      weight: 172.4,
      isBodyWeight: true,
      addedWeight: null,
      addedWeightNote: null,
      load: 172.4,
      completed: true,
      movement: pullUp,
    };
    expect(sets).toEqual([snapshot, snapshot]);
    expect((await workouts.get(db, user.id))?.sets).toEqual(sets);
  });

  test("keeps the Body Weight Snapshot when a later Body Weight Entry is recorded", async () => {
    const { user, pullUp } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);
    expectOk(await workouts.addSet(db, user.id, { movementId: pullUp.id, reps: 8, weight: 0 }, "UTC"));

    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-05", weight: 168 }, "UTC"));
    const { sets } = expectOk(await workouts.addSet(db, user.id, { movementId: pullUp.id, reps: 6, weight: 0 }, "UTC"));

    expect(sets.map((set) => set.weight)).toEqual([168]);
    expect((await workouts.get(db, user.id))?.sets.map((set) => set.weight)).toEqual([172.4, 168]);
  });

  test("a Movement that isn't body-weight keeps the weight the form sent, even with a Body Weight Entry", async () => {
    const { user } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);
    const bench = await createMovement(db, user.id, { name: "Bench Press" });

    const {
      sets: [set],
    } = expectOk(await workouts.addSet(db, user.id, { movementId: bench.id, reps: 5, weight: 225 }, "UTC"));

    expect(set).toMatchObject({ weight: 225, isBodyWeight: false, load: 225 });
  });
});

describe("addSet on a Body-weight Movement with no Body Weight Entry yet", () => {
  test("uses the weight the form sent as the snapshot and records it as today's entry, in the user's zone", async () => {
    // 22:00 on Nov 6 in São Paulo is 01:00 on Nov 7 in UTC.
    setNow("2026-11-07T01:00:00Z");
    const { user, pullUp } = await lifterWithPullUps();

    const result = expectOk(
      await workouts.addSet(db, user.id, { movementId: pullUp.id, reps: 8, weight: 172.4 }, saoPaulo),
    );

    expect(result.recordedBodyWeight).toEqual({ date: "2026-11-06", weight: 172.4 });
    expect(result.sets.map((set) => ({ weight: set.weight, isBodyWeight: set.isBodyWeight }))).toEqual([
      { weight: 172.4, isBodyWeight: true },
    ]);
    expect(await bodyWeight.list(db, user.id)).toEqual([{ date: "2026-11-06", weight: 172.4 }]);
  });

  test("refuses a body weight of 0, and records nothing", async () => {
    const { user, pullUp } = await lifterWithPullUps();

    const result = await workouts.addSet(db, user.id, { movementId: pullUp.id, reps: 8, weight: 0 }, "UTC");

    expect(result).toEqual({ ok: false, reason: "body-weight-required" });
    expect(await bodyWeight.list(db, user.id)).toEqual([]);
    expect((await workouts.get(db, user.id))?.sets).toEqual([]);
  });

  test("records nothing once there is an entry, or for a Movement that isn't body-weight", async () => {
    const { user, pullUp } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);
    const bench = await createMovement(db, user.id, { name: "Bench Press" });

    const pullUps = expectOk(await workouts.addSet(db, user.id, { movementId: pullUp.id, reps: 8, weight: 0 }, "UTC"));
    const benchPress = expectOk(
      await workouts.addSet(db, user.id, { movementId: bench.id, reps: 5, weight: 225 }, "UTC"),
    );

    expect(pullUps.recordedBodyWeight).toBeNull();
    expect(benchPress.recordedBodyWeight).toBeNull();
    expect(await bodyWeight.list(db, user.id)).toEqual([{ date: "2026-11-03", weight: 172.4 }]);
  });

  test("a user with no entry who logs a Movement that isn't body-weight gets no entry", async () => {
    const user = await createUser(db);
    const bench = await createMovement(db, user.id, { name: "Bench Press" });
    expectOk(await workouts.start(db, user.id));

    const result = expectOk(await workouts.addSet(db, user.id, { movementId: bench.id, reps: 5, weight: 225 }, "UTC"));

    expect(result.recordedBodyWeight).toBeNull();
    expect(await bodyWeight.list(db, user.id)).toEqual([]);
  });
});

describe("addSet with Added Weight", () => {
  test("saves it with its note on a body-weight Set, and Load adds it to the snapshot", async () => {
    const { user, pullUp } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);
    const draft = { movementId: pullUp.id, reps: 5, weight: 0 };

    const weighted = expectOk(
      await workouts.addSet(db, user.id, { ...draft, addedWeight: 25, addedWeightNote: "dip belt" }, "UTC"),
    );
    const assisted = expectOk(
      await workouts.addSet(db, user.id, { ...draft, addedWeight: -20.5, addedWeightNote: "red band" }, "UTC"),
    );

    const added = (sets: workouts.WorkoutSet[]) =>
      sets.map(({ weight, addedWeight, addedWeightNote, load }) => ({ weight, addedWeight, addedWeightNote, load }));
    expect([...added(weighted.sets), ...added(assisted.sets)]).toEqual([
      { weight: 172.4, addedWeight: 25, addedWeightNote: "dip belt", load: 197.4 },
      { weight: 172.4, addedWeight: -20.5, addedWeightNote: "red band", load: 151.9 },
    ]);
    expect(added((await workouts.get(db, user.id))!.sets)).toEqual([...added(weighted.sets), ...added(assisted.sets)]);
  });

  test("accepts assistance equal to the body weight, a Load of 0", async () => {
    const { user, pullUp } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);

    const {
      sets: [set],
    } = expectOk(
      await workouts.addSet(
        db,
        user.id,
        { movementId: pullUp.id, reps: 5, weight: 0, addedWeight: -172.4, addedWeightNote: "assisted machine" },
        "UTC",
      ),
    );

    expect(set.load).toBe(0);
  });

  test("returns assistance-exceeds-body-weight for assistance above the Latest Body Weight, and logs nothing", async () => {
    const { user, pullUp } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);

    const result = await workouts.addSet(
      db,
      user.id,
      // The form sent a heavier body weight; the snapshot decides.
      { movementId: pullUp.id, reps: 5, weight: 200, addedWeight: -172.41, addedWeightNote: "assisted machine" },
      "UTC",
    );

    expect(result).toEqual({ ok: false, reason: "assistance-exceeds-body-weight" });
    expect((await workouts.get(db, user.id))?.sets).toEqual([]);
  });

  test("with no entry yet, checks the assistance against the body weight sent, and records nothing when it exceeds it", async () => {
    const { user, pullUp } = await lifterWithPullUps();

    const result = await workouts.addSet(
      db,
      user.id,
      { movementId: pullUp.id, reps: 5, weight: 150, addedWeight: -150.01, addedWeightNote: "assisted machine" },
      "UTC",
    );

    expect(result).toEqual({ ok: false, reason: "assistance-exceeds-body-weight" });
    expect(await bodyWeight.list(db, user.id)).toEqual([]);
    expect((await workouts.get(db, user.id))?.sets).toEqual([]);
  });

  test("returns added-weight-not-allowed for a Movement that isn't body-weight, and logs nothing", async () => {
    const { user } = await lifterWithPullUps();
    const bench = await createMovement(db, user.id, { name: "Bench Press" });

    const result = await workouts.addSet(
      db,
      user.id,
      { movementId: bench.id, reps: 5, weight: 135, addedWeight: 10, addedWeightNote: "chains" },
      "UTC",
    );

    expect(result).toEqual({ ok: false, reason: "added-weight-not-allowed" });
    expect((await workouts.get(db, user.id))?.sets).toEqual([]);
  });
});

/** The Weight, Load and state of every Set of the Current Workout, as get() returns them. */
async function currentSets(userId: string) {
  const workout = await workouts.get(db, userId);
  return workout!.sets.map(({ weight, load, completed }) => ({ weight, load, completed }));
}

describe("a Planned body-weight Set", () => {
  test("shows the Latest Body Weight of the moment, and its Load follows it", async () => {
    const { user, pullUp } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);
    const {
      sets: [set],
    } = expectOk(
      await workouts.addSet(
        db,
        user.id,
        { movementId: pullUp.id, reps: 5, weight: 0, addedWeight: 25, addedWeightNote: "dip belt" },
        "UTC",
      ),
    );
    expectOk(await workouts.setCompleted(db, user.id, set.id, false));

    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-05", weight: 168 }, "UTC"));

    expect(await currentSets(user.id)).toEqual([{ weight: 168, load: 193, completed: false }]);
  });

  test("shows the weight it last had when the user has no Body Weight Entry left", async () => {
    const { user, pullUp } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);
    const {
      sets: [set],
    } = expectOk(await workouts.addSet(db, user.id, { movementId: pullUp.id, reps: 5, weight: 0 }, "UTC"));
    expectOk(await workouts.setCompleted(db, user.id, set.id, false));

    expectOk(await bodyWeight.remove(db, user.id, "2026-11-03"));

    expect(await currentSets(user.id)).toEqual([{ weight: 172.4, load: 172.4, completed: false }]);
  });
});

describe("setCompleted on a body-weight Set", () => {
  test("completing it again takes a new Body Weight Snapshot", async () => {
    const { user, pullUp } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);
    const {
      sets: [set],
    } = expectOk(await workouts.addSet(db, user.id, { movementId: pullUp.id, reps: 5, weight: 0 }, "UTC"));
    expectOk(await workouts.setCompleted(db, user.id, set.id, false));
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-05", weight: 168 }, "UTC"));

    expectOk(await workouts.setCompleted(db, user.id, set.id, true));

    // A later entry no longer moves it: it is a snapshot again.
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-06", weight: 170 }, "UTC"));
    expect(await currentSets(user.id)).toEqual([{ weight: 168, load: 168, completed: true }]);
  });

  test("completing a Set that is already completed changes nothing, even its snapshot", async () => {
    const { user, pullUp } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);
    const {
      sets: [set],
    } = expectOk(
      await workouts.addSet(
        db,
        user.id,
        { movementId: pullUp.id, reps: 5, weight: 0, addedWeight: -100, addedWeightNote: "assisted machine" },
        "UTC",
      ),
    );
    // Lower than the assistance: the Set is already completed, so nothing is checked or changed.
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-05", weight: 90 }, "UTC"));

    expect(await workouts.setCompleted(db, user.id, set.id, true)).toEqual({ ok: true });

    expect(await currentSets(user.id)).toEqual([{ weight: 172.4, load: 72.4, completed: true }]);
  });

  test("returns assistance-exceeds-body-weight when the new snapshot is below the assistance, and leaves it planned", async () => {
    const { user, pullUp } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);
    const {
      sets: [set],
    } = expectOk(
      await workouts.addSet(
        db,
        user.id,
        { movementId: pullUp.id, reps: 5, weight: 0, addedWeight: -100, addedWeightNote: "assisted machine" },
        "UTC",
      ),
    );
    expectOk(await workouts.setCompleted(db, user.id, set.id, false));
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-05", weight: 90 }, "UTC"));

    const result = await workouts.setCompleted(db, user.id, set.id, true);

    expect(result).toEqual({ ok: false, reason: "assistance-exceeds-body-weight" });
    expect(await currentSets(user.id)).toEqual([{ weight: 90, load: -10, completed: false }]);
  });

  test("keeps the weight it had when the user has no Body Weight Entry left", async () => {
    const { user, pullUp } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);
    const {
      sets: [set],
    } = expectOk(await workouts.addSet(db, user.id, { movementId: pullUp.id, reps: 5, weight: 0 }, "UTC"));
    expectOk(await workouts.setCompleted(db, user.id, set.id, false));
    expectOk(await bodyWeight.remove(db, user.id, "2026-11-03"));

    expectOk(await workouts.setCompleted(db, user.id, set.id, true));

    expect(await currentSets(user.id)).toEqual([{ weight: 172.4, load: 172.4, completed: true }]);
  });
});

// The per-set flag decides, never the Movement's current flag (ADR 0003).
describe("turning a Movement's body-weight flag after a Set was logged", () => {
  test("on: a Set logged with a barbell keeps its weight when completed again", async () => {
    const { user } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);
    const ringDip = await createMovement(db, user.id, { name: "Ring Dip" });
    const {
      sets: [set],
    } = expectOk(await workouts.addSet(db, user.id, { movementId: ringDip.id, reps: 5, weight: 135 }, "UTC"));
    expectOk(await workouts.setCompleted(db, user.id, set.id, false));

    expectOk(await movements.update(db, user.id, ringDip.id, { isBodyWeight: true }));
    expectOk(await workouts.setCompleted(db, user.id, set.id, true));

    const [after] = (await workouts.get(db, user.id))!.sets;
    expect(after).toMatchObject({ weight: 135, load: 135, isBodyWeight: false, completed: true });
  });

  test("off: a Set logged as body-weight takes a fresh snapshot when completed again", async () => {
    const { user, pullUp } = await lifterWithPullUps([{ date: "2026-11-03", weight: 172.4 }]);
    const {
      sets: [set],
    } = expectOk(await workouts.addSet(db, user.id, { movementId: pullUp.id, reps: 5, weight: 0 }, "UTC"));
    expectOk(await workouts.setCompleted(db, user.id, set.id, false));
    expectOk(await bodyWeight.record(db, user.id, { date: "2026-11-05", weight: 168 }, "UTC"));

    expectOk(await movements.update(db, user.id, pullUp.id, { isBodyWeight: false }));
    expectOk(await workouts.setCompleted(db, user.id, set.id, true));

    const [after] = (await workouts.get(db, user.id))!.sets;
    expect(after).toMatchObject({ weight: 168, load: 168, isBodyWeight: true, completed: true });
  });
});
