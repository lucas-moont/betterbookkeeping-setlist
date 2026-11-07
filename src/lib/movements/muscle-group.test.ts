import { expect, test } from "vitest";
import { muscleGroups } from "./muscle-group";

// The order is a product rule (CONTEXT.md, ADR 0011): a Workout's Muscle Groups come out in it.
// Reordering the enum in prisma/schema.prisma would silently change every screen, so it is pinned.
test("the Muscle Groups come in the fixed order of the list", () => {
  expect(muscleGroups).toEqual(["CHEST", "BACK", "SHOULDERS", "ARMS", "LEGS", "ABS", "LOWER_BACK"]);
});
