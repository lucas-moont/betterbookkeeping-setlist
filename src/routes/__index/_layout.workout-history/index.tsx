import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { progressionMetricsQueryOptions, progressionMovementsQueryOptions } from "@/lib/progression/queries";
import { historyPageSize, historyPageSizeSchema } from "@/lib/workouts/history-page";
import { workoutHistoryInfiniteQueryOptions } from "@/lib/workouts/queries";
import { CompletedWorkouts } from "./-components/completed-workouts";
import { defaultMovement } from "./-components/progression";
import { ProgressionCard } from "./-components/progression-card";

// ?pageSize= sets how many workouts a page shows. It isn't linked from anywhere: the e2e uses it to
// reach a second page with a few workouts. Anything the server wouldn't take falls back to the default.
const historySearchSchema = z.object({ pageSize: historyPageSizeSchema.optional().catch(undefined) });

export const Route = createFileRoute("/__index/_layout/workout-history/")({
  validateSearch: historySearchSchema,
  loaderDeps: ({ search: { pageSize } }) => ({ pageSize: pageSize ?? historyPageSize }),
  loader: async ({ context: { queryClient, timeZone }, deps: { pageSize } }) => {
    // The chart opens on the default Movement, so its Training Days come with the page, fetched as
    // soon as the Movements are known, while the history still loads.
    await Promise.all([
      queryClient.ensureInfiniteQueryData(workoutHistoryInfiniteQueryOptions(pageSize)),
      queryClient.ensureQueryData(progressionMovementsQueryOptions(timeZone)).then(({ movements }) => {
        const first = defaultMovement(movements);
        return first && queryClient.ensureQueryData(progressionMetricsQueryOptions(first.id, timeZone));
      }),
    ]);
  },
  component: WorkoutHistoryPage,
});

function WorkoutHistoryPage() {
  const { pageSize } = Route.useLoaderDeps();
  const {
    data: workouts,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useSuspenseInfiniteQuery(workoutHistoryInfiniteQueryOptions(pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Workout History</h1>
      </div>

      <ProgressionCard />
      <CompletedWorkouts
        workouts={workouts}
        hasMore={hasNextPage}
        loadingMore={isFetchingNextPage}
        loadMoreFailed={isFetchNextPageError}
        onLoadMore={() => fetchNextPage()}
      />
    </div>
  );
}
