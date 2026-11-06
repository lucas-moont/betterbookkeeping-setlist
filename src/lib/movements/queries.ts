import { queryOptions } from "@tanstack/react-query";
import { serverMutationOptions } from "@/lib/server-mutation";
import { createMovementServerFn, getMovementsServerFn } from "./movements.functions";

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
    mutationFn: (name: string) => createMovementServerFn({ data: { name } }),
    invalidates: [movementKeys.all],
    formErrors: ["movement-name-taken"],
  });
