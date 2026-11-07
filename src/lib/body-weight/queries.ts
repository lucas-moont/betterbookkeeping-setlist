import { queryOptions } from "@tanstack/react-query";
import { serverMutationOptions } from "@/lib/server-mutation";
// workouts/queries imports this module too. Each side reads the other's keys only inside its option
// functions, never at module load, so the cycle is safe.
import { workoutKeys } from "@/lib/workouts/queries";
import type { NewBodyWeightEntry } from "./index";
import {
  deleteBodyWeightEntryServerFn,
  getBodyWeightEntriesServerFn,
  recordBodyWeightServerFn,
} from "./body-weight.functions";

// Every body-weight read lives under one root, so a mutation that changes an entry refreshes them all:
// the Profile and the Latest Body Weight on the Current Workout form.
export const bodyWeightKeys = {
  all: ["body-weight"] as const,
  entries: () => [...bodyWeightKeys.all, "entries"] as const,
};

export const bodyWeightEntriesQueryOptions = () =>
  queryOptions({
    queryKey: bodyWeightKeys.entries(),
    queryFn: () => getBodyWeightEntriesServerFn(),
  });

// A Planned body-weight Set shows the Latest Body Weight (ADR 0011), so changing an entry refreshes
// the Current Workout too. A future date shows under the date field, not in a toast.
export const recordBodyWeightMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (data: NewBodyWeightEntry) => recordBodyWeightServerFn({ data }),
    invalidates: [bodyWeightKeys.all, workoutKeys.current],
    formErrors: ["body-weight-date-in-future"],
  });

export const deleteBodyWeightEntryMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (date: string) => deleteBodyWeightEntryServerFn({ data: { date } }),
    invalidates: [bodyWeightKeys.all, workoutKeys.current],
  });
