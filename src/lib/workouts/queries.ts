import { queryOptions } from "@tanstack/react-query";
import { serverMutationOptions } from "@/lib/server-mutation";
import { progressionKeys } from "@/lib/progression/queries";
import {
  addSetServerFn,
  completeWorkoutServerFn,
  createWorkoutServerFn,
  deleteSetServerFn,
  deleteWorkoutsServerFn,
  getCurrentWorkoutServerFn,
  getWorkoutHistoryServerFn,
  setCompletedServerFn,
  type SetCompletedChange,
} from "./workouts.functions";
import type { SetDraft } from "./set-draft";

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
  serverMutationOptions({
    mutationFn: () => createWorkoutServerFn(),
    invalidates: [workoutKeys.current],
  });

export const addSetMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (data: SetDraft) => addSetServerFn({ data }),
    invalidates: [workoutKeys.current],
  });

// Only Sets of the Current Workout can change state, so neither the history nor the Progression
// Charts are stale (ADR 0011).
export const setCompletedMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (data: SetCompletedChange) => setCompletedServerFn({ data }),
    invalidates: [workoutKeys.current],
  });

export const removeSetMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (setId: string) => deleteSetServerFn({ data: { setId } }),
    invalidates: [workoutKeys.current],
  });

// A Completed Workout leaves the Current Workout and joins the history and the Progression Charts.
export const completeWorkoutMutationOptions = () =>
  serverMutationOptions({
    mutationFn: () => completeWorkoutServerFn(),
    invalidates: [workoutKeys.all, progressionKeys.all],
  });

export const deleteWorkoutsMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (workoutIds: string[]) => deleteWorkoutsServerFn({ data: { workoutIds } }),
    invalidates: [workoutKeys.history, progressionKeys.all],
  });
