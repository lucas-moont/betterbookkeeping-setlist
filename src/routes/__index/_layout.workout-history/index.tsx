import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { workoutHistoryQueryOptions } from "@/lib/workouts/queries";
import { CompletedWorkouts } from "./-components/completed-workouts";

export const Route = createFileRoute("/__index/_layout/workout-history/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(workoutHistoryQueryOptions());
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

      <CompletedWorkouts workouts={workouts} />
    </div>
  );
}
