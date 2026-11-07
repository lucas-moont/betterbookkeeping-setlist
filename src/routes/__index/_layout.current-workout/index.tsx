import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Check } from "lucide-react";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import {
  completeWorkoutMutationOptions,
  currentWorkoutQueryOptions,
  startWorkoutMutationOptions,
} from "@/lib/workouts/queries";
import { movementsQueryOptions } from "@/lib/movements/queries";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTimeZone } from "@/lib/time-zone";
import { SetForm } from "./-components/set-form";
import { SetList } from "./-components/set-list";

export const Route = createFileRoute("/__index/_layout/current-workout/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(currentWorkoutQueryOptions()),
      context.queryClient.ensureQueryData(movementsQueryOptions()),
    ]);
  },
  component: CurrentWorkoutPage,
});

function CurrentWorkoutPage() {
  const { data: workout } = useSuspenseQuery(currentWorkoutQueryOptions());
  const { data: movements } = useSuspenseQuery(movementsQueryOptions());
  const timeZone = useTimeZone();

  const startWorkoutMutation = useMutation(startWorkoutMutationOptions());

  const completeWorkoutMutation = useMutation(completeWorkoutMutationOptions());

  if (!workout) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-900">Current Workout</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 mb-4">No active workout. Ready to start?</p>
            <Button onClick={() => startWorkoutMutation.mutate()} size="lg">
              <Play className="w-4 h-4 mr-2" />
              {startWorkoutMutation.isPending ? "Starting..." : "Start Workout"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Current Workout</h1>
        <Button variant="outline" onClick={() => completeWorkoutMutation.mutate()}>
          <Check className="w-4 h-4 mr-2" />
          {completeWorkoutMutation.isPending ? "Completing..." : "Complete Workout"}
        </Button>
      </div>

      <Card>
        {/* The day the workout started. One from before start times were recorded has none, and
            no date is shown rather than a guessed one (ADR 0007). */}
        {workout.startedAt && (
          <CardHeader>
            <CardTitle>{formatDate(workout.startedAt, timeZone, "long")}</CardTitle>
          </CardHeader>
        )}
        {/* CardContent drops its top padding for the header above it; with no header, it keeps it. */}
        <CardContent className={cn("space-y-4", !workout.startedAt && "pt-6")}>
          <SetForm movements={movements} />
          <SetList sets={workout.sets} />
        </CardContent>
      </Card>
    </div>
  );
}
