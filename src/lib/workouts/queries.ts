import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { progressionKeys } from "@/lib/progression/queries";
import {
  addSetServerFn,
  completeWorkoutServerFn,
  createWorkoutServerFn,
  deleteSetServerFn,
  deleteWorkoutsServerFn,
  getCurrentWorkoutServerFn,
  getWorkoutHistoryServerFn,
} from "./workouts.functions";

// The Current Workout and the history read the same rows, so they share the "workouts" root.
const workoutsRoot = ["workouts"] as const;

export const workoutKeys = {
  all: workoutsRoot,
  current: [...workoutsRoot, "current"] as const,
  history: [...workoutsRoot, "history"] as const,
};

export const currentWorkoutQueryOptions = () =>
  queryOptions({
    queryKey: workoutKeys.current,
    queryFn: () => getCurrentWorkoutServerFn(),
  });

export const workoutHistoryQueryOptions = () =>
  queryOptions({
    queryKey: workoutKeys.history,
    queryFn: () => getWorkoutHistoryServerFn(),
  });

export const startWorkoutMutationOptions = () =>
  mutationOptions({
    mutationFn: () => createWorkoutServerFn(),
    meta: { invalidates: [workoutKeys.current] },
  });

export const addSetMutationOptions = () =>
  mutationOptions({
    mutationFn: (data: { movementId: string; reps: number; weight: number }) => addSetServerFn({ data }),
    meta: { invalidates: [workoutKeys.current] },
  });

export const removeSetMutationOptions = () =>
  mutationOptions({
    mutationFn: (setId: string) => deleteSetServerFn({ data: { setId } }),
    meta: { invalidates: [workoutKeys.current] },
  });

// A Completed Workout leaves the Current Workout and joins the history and the Progression Charts.
export const completeWorkoutMutationOptions = () =>
  mutationOptions({
    mutationFn: () => completeWorkoutServerFn(),
    meta: { invalidates: [workoutKeys.all, progressionKeys.all] },
  });

export const deleteWorkoutsMutationOptions = () =>
  mutationOptions({
    mutationFn: (workoutIds: string[]) => deleteWorkoutsServerFn({ data: { workoutIds } }),
    meta: { invalidates: [workoutKeys.history, progressionKeys.all] },
  });
