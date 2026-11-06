import { getMovementsServerFn } from "@/lib/movements/movements.functions";
import { queryOptions } from "@tanstack/react-query";

export const movementsQueryOptions = () =>
  queryOptions({
    queryKey: ["movements"],
    queryFn: () => getMovementsServerFn(),
  });
