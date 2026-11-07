import type { Movement } from "@/lib/movements";
import type { WorkoutSet } from "@/lib/workouts";

/** The sets of one Movement in the Current Workout, and how many of them are Completed Sets. */
export type MovementSets = { movement: Movement; sets: WorkoutSet[]; completed: number };

/**
 * Groups the sets by Movement, each group where its Movement first appears. The sets keep the order
 * they come in (the order they were added), so marking one completed or planned never moves a row.
 */
export function groupSetsByMovement(sets: WorkoutSet[]): MovementSets[] {
  const groups = new Map<string, MovementSets>();
  for (const set of sets) {
    let group = groups.get(set.movement.id);
    if (!group) {
      group = { movement: set.movement, sets: [], completed: 0 };
      groups.set(set.movement.id, group);
    }
    group.sets.push(set);
    if (set.completed) group.completed += 1;
  }
  return [...groups.values()];
}
