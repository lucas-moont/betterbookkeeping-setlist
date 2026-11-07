import { queryOptions } from "@tanstack/react-query";
import { serverMutationOptions } from "@/lib/server-mutation";
import { workoutKeys } from "@/lib/workouts/queries";
import type { NewMovement } from "./index";
import {
  createMovementServerFn,
  getMovementsServerFn,
  setMovementMuscleGroupServerFn,
  updateMovementServerFn,
  type MovementEdit,
  type MuscleGroupChange,
} from "./movements.functions";

export const movementKeys = {
  all: ["movements"] as const,
};

export const movementsQueryOptions = () =>
  queryOptions({
    queryKey: movementKeys.all,
    queryFn: () => getMovementsServerFn(),
  });

// A taken name shows under the name field, not in a toast.
export const createMovementMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (data: NewMovement) => createMovementServerFn({ data }),
    invalidates: [movementKeys.all],
    formErrors: ["movement-name-taken"],
  });

// A Workout's Muscle Groups are read from its Movements (ADR 0011), so changing one changes the
// Current Workout and every Workout in the history that used it.
export const setMuscleGroupMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (data: MuscleGroupChange) => setMovementMuscleGroupServerFn({ data }),
    invalidates: [movementKeys.all, workoutKeys.all],
  });

// The edit dialog. A Set reads its Movement's name and a Workout its Muscle Groups (ADR 0011), so
// the Current Workout and the history refresh too. A taken name shows under the name field.
export const updateMovementMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (data: MovementEdit) => updateMovementServerFn({ data }),
    invalidates: [movementKeys.all, workoutKeys.all],
    formErrors: ["movement-name-taken"],
  });
