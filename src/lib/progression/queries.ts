import { queryOptions } from "@tanstack/react-query";
import { unwrap } from "@/lib/error-codes";
import { getProgressionMovementsServerFn, getProgressionServerFn } from "./progression.functions";

// Every progression read lives under one root, which the workout and movement mutations list in
// meta.invalidates. The zone is part of each key: the same rows give other Training Days in another
// zone (ADR 0004), and the server reads the zone from the same tz cookie as useTimeZone().
export const progressionKeys = {
  all: ["progression"] as const,
  movements: (timeZone: string) => [...progressionKeys.all, "movements", timeZone] as const,
  metrics: (movementId: string, timeZone: string) => [...progressionKeys.all, "metrics", movementId, timeZone] as const,
};

// invalid-time-zone is thrown as a ServerResultError, so the route's error component shows its
// message; the data is always the success.
export const progressionMovementsQueryOptions = (timeZone: string) =>
  queryOptions({
    queryKey: progressionKeys.movements(timeZone),
    queryFn: async () => unwrap(await getProgressionMovementsServerFn()),
  });

export const progressionMetricsQueryOptions = (movementId: string, timeZone: string) =>
  queryOptions({
    queryKey: progressionKeys.metrics(movementId, timeZone),
    queryFn: async () => unwrap(await getProgressionServerFn({ data: { movementId } })),
  });
