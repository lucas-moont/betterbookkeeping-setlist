import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { createMovementServerFn, getMovementsServerFn } from "./movements.functions";

export const movementKeys = {
  all: ["movements"] as const,
};

export const movementsQueryOptions = () =>
  queryOptions({
    queryKey: movementKeys.all,
    queryFn: () => getMovementsServerFn(),
  });

export const createMovementMutationOptions = () =>
  mutationOptions({
    mutationFn: (name: string) => createMovementServerFn({ data: { name } }),
    meta: { invalidates: [movementKeys.all] },
  });
