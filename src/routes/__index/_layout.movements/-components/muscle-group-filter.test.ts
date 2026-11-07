import { describe, expect, test } from "vitest";
import type { Movement } from "@/lib/movements";
import { filterOptions, matchesFilter } from "./muscle-group-filter";

const movement = (name: string, muscleGroup: Movement["muscleGroup"]): Movement => ({
  id: name,
  name,
  muscleGroup,
  isBodyWeight: false,
});

const squat = movement("Squat", "LEGS");
const deadlift = movement("Deadlift", "LOWER_BACK");
const bench = movement("Bench Press", "CHEST");
const curl = movement("Curl", null);

describe("filterOptions", () => {
  test("offers All, each group in use in the fixed order, and No group, each with its count", () => {
    expect(filterOptions([squat, deadlift, bench, curl, movement("Lunge", "LEGS")])).toEqual([
      { value: "all", label: "All", count: 5 },
      { value: "CHEST", label: "Chest", count: 1 },
      { value: "LEGS", label: "Legs", count: 2 },
      { value: "LOWER_BACK", label: "Lower Back", count: 1 },
      { value: "none", label: "No group", count: 1 },
    ]);
  });

  test("leaves out No group when every Movement has one", () => {
    expect(filterOptions([squat]).map((option) => option.value)).toEqual(["all", "LEGS"]);
  });

  test("offers only All when there are no Movements", () => {
    expect(filterOptions([])).toEqual([{ value: "all", label: "All", count: 0 }]);
  });
});

describe("matchesFilter", () => {
  test("All shows every Movement, a group only its own, and No group the ones without", () => {
    const all = [squat, deadlift, bench, curl];

    expect(all.filter((m) => matchesFilter(m, "all"))).toEqual(all);
    expect(all.filter((m) => matchesFilter(m, "LEGS"))).toEqual([squat]);
    expect(all.filter((m) => matchesFilter(m, "none"))).toEqual([curl]);
  });
});
