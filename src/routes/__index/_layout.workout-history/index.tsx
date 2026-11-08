import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { progressionMetricsQueryOptions, progressionMovementsQueryOptions } from "@/lib/progression/queries";
import { workoutHistoryQueryOptions } from "@/lib/workouts/queries";
import { CompletedWorkouts } from "./-components/completed-workouts";
import { defaultMovement } from "./-components/progression";
import { ProgressionCard } from "./-components/progression-card";

export const Route = createFileRoute("/__index/_layout/workout-history/")({
  loader: async ({ context: { queryClient, timeZone } }) => {
    const [, { movements }] = await Promise.all([
      queryClient.ensureQueryData(workoutHistoryQueryOptions()),
      queryClient.ensureQueryData(progressionMovementsQueryOptions(timeZone)),
    ]);
    // The chart opens on the default Movement, so its Training Days come with the page.
    const first = defaultMovement(movements);
    if (first) await queryClient.ensureQueryData(progressionMetricsQueryOptions(first.id, timeZone));
  },
  component: WorkoutHistoryPage,
});

function WorkoutHistoryPage() {
  const { data: workouts } = useSuspenseQuery(workoutHistoryQueryOptions());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Workout History</h1>
      </div>

      <ProgressionCard />
      <CompletedWorkouts workouts={workouts} />
    </div>
  );
}
