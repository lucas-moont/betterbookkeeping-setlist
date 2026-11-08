import { queryOptions, type MutationFunctionContext } from "@tanstack/react-query";
import { ServerResultError } from "@/lib/error-codes";
import { serverMutationOptions } from "@/lib/server-mutation";
import { bodyWeightKeys } from "@/lib/body-weight/queries";
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
import type { WhenEmpty } from "./index";
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
    // The first page only, until the screen loads more.
    queryFn: () => getWorkoutHistoryServerFn({ data: {} }),
  });

export const startWorkoutMutationOptions = () =>
  serverMutationOptions({
    mutationFn: () => createWorkoutServerFn(),
    invalidates: [workoutKeys.current],
  });

// The first Set of a Body-weight Movement can record the user's first Body Weight Entry, which the
// Profile and the Current Workout form read (ADR 0003). The form shows the refusals about the
// weights it sent beside those fields.
export const addSetMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (data: SetDraft) => addSetServerFn({ data }),
    invalidates: [workoutKeys.current, bodyWeightKeys.all],
    formErrors: ["assistance-exceeds-body-weight", "added-weight-not-allowed", "body-weight-required"],
  });

// Only Sets of the Current Workout can change state, so neither the history nor the Progression
// Charts are stale (ADR 0011). Completing a body-weight Set again can refuse with
// assistance-exceeds-body-weight; there is no form, so it is a toast.
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
// A workout with no Completed Sets is refused with empty-workout until the user picks whenEmpty:
// the page asks in a dialog instead of a toast.
export const completeWorkoutMutationOptions = () => ({
  ...serverMutationOptions({
    mutationFn: (whenEmpty?: WhenEmpty) => completeWorkoutServerFn({ data: { whenEmpty } }),
    invalidates: [workoutKeys.all, progressionKeys.all],
    formErrors: ["empty-workout"],
  }),
  // A refusal means the Current Workout on screen was out of date, for example a Set completed in
  // another tab. Reload it before the error lands, so the dialog counts the right Sets and the
  // screen shows why discarding was refused.
  onError: (
    error: Error,
    _variables: WhenEmpty | undefined,
    _onMutateResult: unknown,
    { client }: MutationFunctionContext,
  ) => (error instanceof ServerResultError ? client.invalidateQueries({ queryKey: workoutKeys.current }) : undefined),
});

export const deleteWorkoutsMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (workoutIds: string[]) => deleteWorkoutsServerFn({ data: { workoutIds } }),
    invalidates: [workoutKeys.history, progressionKeys.all],
  });
