import { getCurrentWorkoutServerFn } from "@/lib/workouts/workouts.functions";
import { getMovementsServerFn } from "@/lib/movements/movements.functions";
import { queryOptions } from "@tanstack/react-query";

export const currentWorkoutQueryOptions = () =>
  queryOptions({
    queryKey: ["current-workout"],
    queryFn: () => getCurrentWorkoutServerFn(),
  });

export const movementsQueryOptions = () =>
  queryOptions({
    queryKey: ["movements"],
    queryFn: () => getMovementsServerFn(),
  });
