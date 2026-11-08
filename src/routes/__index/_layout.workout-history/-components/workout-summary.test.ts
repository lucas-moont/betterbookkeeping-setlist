import { describe, expect, test } from "vitest";
import type { Movement } from "@/lib/movements";
import type { WorkoutSet } from "@/lib/workouts";
import { historyMovements, movementSummary, setCount } from "./workout-summary";

const movement = (name: string): Movement => ({ id: name, name, muscleGroup: null, isBodyWeight: false });

const bench = movement("Bench Press");
const squat = movement("Back Squat");
const pullUp = movement("Pull-up");

const set = (of: Movement, reps: number, load: number, completed = true): WorkoutSet => ({
  id: `${of.id}-${reps}-${load}-${completed}`,
  reps,
  weight: load,
  addedWeight: null,
  addedWeightNote: null,
  isBodyWeight: false,
  load,
  completed,
  movement: of,
});

describe("setCount", () => {
  test("counts the Completed Sets out of every set", () => {
    expect(setCount([set(bench, 5, 100), set(bench, 5, 100, false), set(squat, 3, 200)])).toEqual({
      completed: 2,
      total: 3,
    });
  });
});

describe("movementSummary", () => {
  test("takes the heaviest Load and the average Reps from the Completed Sets only", () => {
    const sets = [set(bench, 8, 185), set(bench, 5, 205), set(bench, 12, 315, false), set(squat, 1, 400)];

    expect(movementSummary(sets, bench.id)).toEqual({ completed: 2, total: 3, heaviestLoad: 205, averageReps: 7 });
  });

  test("has no Load or Reps for a Movement whose sets are all planned", () => {
    expect(movementSummary([set(bench, 5, 100, false)], bench.id)).toEqual({ completed: 0, total: 1 });
  });

  test("is nothing for a Movement the workout doesn't have", () => {
    expect(movementSummary([set(bench, 5, 100)], squat.id)).toBeNull();
  });

  test("reads the Load, so an assisted set counts below the body weight", () => {
    const assisted = { ...set(pullUp, 6, 132.4), weight: 172.4, addedWeight: -40, isBodyWeight: true };

    expect(movementSummary([assisted], pullUp.id)).toMatchObject({ heaviestLoad: 132.4 });
  });
});

describe("historyMovements", () => {
  test("lists every Movement with a set in any workout, planned ones too, by name", () => {
    const workouts = [{ sets: [set(squat, 5, 100)] }, { sets: [set(bench, 5, 100, false), set(squat, 3, 200)] }];

    expect(historyMovements(workouts).map((m) => m.name)).toEqual(["Back Squat", "Bench Press"]);
  });
});
