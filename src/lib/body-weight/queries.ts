import { queryOptions } from "@tanstack/react-query";
import { serverMutationOptions } from "@/lib/server-mutation";
import type { NewBodyWeightEntry } from "./index";
import {
  deleteBodyWeightEntryServerFn,
  getBodyWeightEntriesServerFn,
  recordBodyWeightServerFn,
} from "./body-weight.functions";

// Every body-weight read lives under one root, so a mutation that changes an entry refreshes them all
// (the Profile now, the Latest Body Weight on Current Workout later).
export const bodyWeightKeys = {
  all: ["body-weight"] as const,
  entries: () => [...bodyWeightKeys.all, "entries"] as const,
};

export const bodyWeightEntriesQueryOptions = () =>
  queryOptions({
    queryKey: bodyWeightKeys.entries(),
    queryFn: () => getBodyWeightEntriesServerFn(),
  });

// A future date shows under the date field, not in a toast.
export const recordBodyWeightMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (data: NewBodyWeightEntry) => recordBodyWeightServerFn({ data }),
    invalidates: [bodyWeightKeys.all],
    formErrors: ["body-weight-date-in-future"],
  });

export const deleteBodyWeightEntryMutationOptions = () =>
  serverMutationOptions({
    mutationFn: (date: string) => deleteBodyWeightEntryServerFn({ data: { date } }),
    invalidates: [bodyWeightKeys.all],
  });
