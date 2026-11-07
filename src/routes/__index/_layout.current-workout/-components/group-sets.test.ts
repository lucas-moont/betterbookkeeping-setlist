import { describe, expect, test } from "vitest";
import type { Movement } from "@/lib/movements";
import type { WorkoutSet } from "@/lib/workouts";
import { groupSetsByMovement } from "./group-sets";

const movement = (name: string): Movement => ({ id: name, name, muscleGroup: null, isBodyWeight: false });

const bench = movement("Bench Press");
const squat = movement("Back Squat");

const set = (id: string, of: Movement, completed = true): WorkoutSet => ({
  id,
  reps: 5,
  weight: 100,
  load: 100,
  completed,
  movement: of,
});

describe("groupSetsByMovement", () => {
  test("groups the sets by Movement in the order each Movement first appears", () => {
    const groups = groupSetsByMovement([set("1", bench), set("2", squat), set("3", bench)]);

    expect(groups.map((group) => [group.movement.name, group.sets.map((s) => s.id)])).toEqual([
      ["Bench Press", ["1", "3"]],
      ["Back Squat", ["2"]],
    ]);
  });

  test("counts the Completed Sets of each group", () => {
    const groups = groupSetsByMovement([set("1", bench), set("2", bench, false), set("3", bench)]);

    expect(groups.map((group) => group.completed)).toEqual([2]);
  });

  test("has no groups without sets", () => {
    expect(groupSetsByMovement([])).toEqual([]);
  });
});
