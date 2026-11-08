import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Check } from "lucide-react";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { isFormError } from "@/lib/server-mutation";
import type { WhenEmpty } from "@/lib/workouts";
import {
  completeWorkoutMutationOptions,
  currentWorkoutQueryOptions,
  startWorkoutMutationOptions,
} from "@/lib/workouts/queries";
import { movementsQueryOptions } from "@/lib/movements/queries";
import { bodyWeightEntriesQueryOptions } from "@/lib/body-weight/queries";
import { latestEntry } from "@/lib/body-weight/entry";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTimeZone } from "@/lib/time-zone";
import { EmptyWorkoutDialog } from "./-components/empty-workout-dialog";
import { MuscleGroups } from "./-components/muscle-groups";
import { SetForm } from "./-components/set-form";
import { SetList } from "./-components/set-list";

export const Route = createFileRoute("/__index/_layout/current-workout/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(currentWorkoutQueryOptions()),
      context.queryClient.ensureQueryData(movementsQueryOptions()),
      context.queryClient.ensureQueryData(bodyWeightEntriesQueryOptions()),
    ]);
  },
  component: CurrentWorkoutPage,
});

function CurrentWorkoutPage() {
  const { data: workout } = useSuspenseQuery(currentWorkoutQueryOptions());
  const { data: movements } = useSuspenseQuery(movementsQueryOptions());
  const { data: bodyWeightEntries } = useSuspenseQuery(bodyWeightEntriesQueryOptions());
  const timeZone = useTimeZone();

  const startWorkoutMutation = useMutation(startWorkoutMutationOptions());

  const completeWorkoutOptions = completeWorkoutMutationOptions();
  const completeWorkoutMutation = useMutation(completeWorkoutOptions);
  // What the lifter chose for a workout with no Completed Sets, once it is done. A workout with a
  // Completed Set completes with no choice (undefined) and gets no notice.
  const outcome = completeWorkoutMutation.isSuccess ? completeWorkoutMutation.variables : undefined;
  const movementRef = useRef<HTMLSelectElement>(null);

  // The server answers empty-workout instead of completing a workout with no Completed Sets, and the
  // page asks what to do with it. The dialog stays open while the answer is being saved.
  const choosing = completeWorkoutMutation.isPending ? (completeWorkoutMutation.variables ?? null) : null;
  const askWhenEmpty = isFormError(completeWorkoutMutation.error, completeWorkoutOptions.meta) || choosing !== null;

  if (!workout) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Current Workout</h1>
          <OutcomeStatus outcome={outcome} />
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 mb-4">No active workout. Ready to start?</p>
            <Button
              onClick={() => {
                // The notice is about the last workout, not the one starting.
                completeWorkoutMutation.reset();
                startWorkoutMutation.mutate();
              }}
              size="lg">
              <Play className="w-4 h-4 mr-2" />
              {startWorkoutMutation.isPending ? "Starting..." : "Start Workout"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasHeader = workout.startedAt !== null || workout.muscleGroups.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Current Workout</h1>
        <Button variant="outline" onClick={() => completeWorkoutMutation.mutate(undefined)} className="shrink-0">
          <Check className="w-4 h-4" />
          {completeWorkoutMutation.isPending ? (
            "Completing..."
          ) : (
            // The short label keeps the title on one line on a phone.
            <>
              <span className="sm:hidden">Complete</span>
              <span className="hidden sm:inline">Complete Workout</span>
            </>
          )}
        </Button>
      </div>

      <Card>
        {hasHeader && (
          <CardHeader className="space-y-3">
            {/* The day the workout started. One from before start times were recorded has none, and
                no date is shown rather than a guessed one (ADR 0007). */}
            {workout.startedAt && <CardTitle>{formatDate(workout.startedAt, timeZone, "long")}</CardTitle>}
            <MuscleGroups groups={workout.muscleGroups} />
          </CardHeader>
        )}
        {/* CardContent drops its top padding for the header above it; with no header, it keeps it. */}
        <CardContent className={cn("space-y-4", !hasHeader && "pt-6")}>
          <SetForm movements={movements} latestBodyWeight={latestEntry(bodyWeightEntries)} movementRef={movementRef} />
          <SetList sets={workout.sets} />
        </CardContent>
      </Card>

      <EmptyWorkoutDialog
        open={askWhenEmpty}
        plannedSets={workout.sets.length}
        pending={choosing}
        onChoose={(whenEmpty) => completeWorkoutMutation.mutate(whenEmpty)}
        onKeepLogging={() => completeWorkoutMutation.reset()}
        returnFocus={movementRef}
      />
    </div>
  );
}

/**
 * The status region above the Start Workout card. The empty state and the outcome arrive in the same
 * render, and a screen reader may not announce a region that appears with its text already in it.
 * So the region goes on screen empty, and the outcome fills it right after.
 */
function OutcomeStatus({ outcome }: { outcome: WhenEmpty | undefined }) {
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);
  return <div role="status">{shown && outcome && <OutcomeNotice outcome={outcome} />}</div>;
}

/**
 * Says what happened to the workout the lifter just saved as a Gym Visit or discarded. Not the Alert
 * primitive: Alert always has role="alert", which interrupts, and this is a polite status.
 */
function OutcomeNotice({ outcome }: { outcome: WhenEmpty }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
      <Check className="w-4 h-4 text-slate-500" aria-hidden="true" />
      {outcome === "save" ? (
        <>
          <span>Saved as a gym visit.</span>
          <Link to="/workout-history" className="font-medium text-primary underline-offset-4 hover:underline">
            View in history
          </Link>
        </>
      ) : (
        <span>Workout discarded.</span>
      )}
    </div>
  );
}
