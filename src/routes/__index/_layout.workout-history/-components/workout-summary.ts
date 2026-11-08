import type { Movement } from "@/lib/movements";
import type { WorkoutSet } from "@/lib/workouts";

// What the history table says about a Completed Workout. Only Completed Sets count toward the numbers
// (CONTEXT.md); the Planned Sets left in it show only in "2 of 3".

export type SetCount = { completed: number; total: number };

/** One Movement in one workout: its set count, and the heaviest Load and average Reps when any set was done. */
export type MovementSummary = SetCount & { heaviestLoad?: number; averageReps?: number };

export function setCount(sets: WorkoutSet[]): SetCount {
  return { completed: sets.filter((set) => set.completed).length, total: sets.length };
}

/** The summary of one Movement's sets in a workout, or null when the workout has none of them. */
export function movementSummary(sets: WorkoutSet[], movementId: string): MovementSummary | null {
  const movementSets = sets.filter((set) => set.movement.id === movementId);
  if (movementSets.length === 0) return null;
  const count = setCount(movementSets);
  const done = movementSets.filter((set) => set.completed);
  if (done.length === 0) return count;
  return {
    ...count,
    heaviestLoad: Math.max(...done.map((set) => set.load)),
    averageReps: Math.round(done.reduce((sum, set) => sum + set.reps, 0) / done.length),
  };
}

/**
 * The table's Movement columns: every Movement with a set in any of the workouts, by name. A Gym
 * Visit's row is one label across these columns, so a Movement only a Gym Visit has gets none.
 */
export function historyMovements(workouts: { sets: WorkoutSet[] }[]): Movement[] {
  const movements = new Map<string, Movement>();
  for (const workout of workouts) {
    if (isGymVisit(workout.sets)) continue;
    for (const set of workout.sets) movements.set(set.movement.id, set.movement);
  }
  return [...movements.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** What a Gym Visit's row says instead of its numbers, or null for a workout with a Completed Set. */
export function gymVisitLabel(sets: WorkoutSet[]): string | null {
  if (!isGymVisit(sets)) return null;
  if (sets.length === 0) return "Gym visit, no sets logged";
  return `Gym visit, 0 of ${sets.length} ${sets.length === 1 ? "set" : "sets"} completed`;
}

/** A Completed Workout with no Completed Sets (CONTEXT.md, Gym Visit). */
function isGymVisit(sets: WorkoutSet[]): boolean {
  return !sets.some((set) => set.completed);
}
