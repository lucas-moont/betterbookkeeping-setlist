import { useId } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatWeight } from "@/lib/format";
import type { WorkoutSet } from "@/lib/workouts";
import { removeSetMutationOptions } from "@/lib/workouts/queries";
import { groupSetsByMovement, type MovementSets } from "./group-sets";

/** The sets of the Current Workout, one section per Movement, in the order they were added. */
export function SetList({ sets }: { sets: WorkoutSet[] }) {
  if (sets.length === 0) {
    return <p className="text-sm text-slate-500">No sets yet. Add exercises to your workout!</p>;
  }

  return (
    <div className="space-y-3">
      {groupSetsByMovement(sets).map((group) => (
        <MovementSection key={group.movement.id} group={group} />
      ))}
    </div>
  );
}

/** One Movement's sets, with how many of them are completed. */
function MovementSection({ group }: { group: MovementSets }) {
  const headingId = useId();
  const { movement, sets, completed } = group;

  return (
    <section aria-labelledby={headingId} className="space-y-2 rounded-lg border border-slate-200 p-3 pr-1">
      <div className="flex items-center justify-between gap-3 pr-2">
        <h4 id={headingId} className="text-sm font-medium text-slate-900">
          {movement.name}
        </h4>
        <span className="text-xs tabular-nums text-slate-500">
          {completed} of {sets.length} completed
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${movement.name} sets completed`}
        aria-valuemin={0}
        aria-valuemax={sets.length}
        aria-valuenow={completed}
        className="mr-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${Math.round((completed / sets.length) * 100)}%` }}
        />
      </div>
      <ul className="space-y-1">
        {sets.map((set, index) => (
          <SetRow key={set.id} set={set} number={index + 1} />
        ))}
      </ul>
    </section>
  );
}

/** One set: its number within the Movement, Reps and Weight, and the button that removes it. */
function SetRow({ set, number }: { set: WorkoutSet; number: number }) {
  const removeSetMutation = useMutation(removeSetMutationOptions());

  return (
    <li className="flex min-h-11 items-center gap-1 rounded-lg border border-transparent bg-slate-50 py-0.5 pl-3 pr-1 text-sm sm:min-h-9">
      <span className="min-w-0 flex-1 tabular-nums text-slate-700">
        <span className="mr-1 text-slate-400">Set {number}</span>{" "}
        {set.reps} reps × {formatWeight(set.weight)}
      </span>
      <Button
        aria-label="Remove set"
        variant="ghost"
        size="icon"
        onClick={() => removeSetMutation.mutate(set.id)}
        className="h-11 w-11 shrink-0 text-slate-400 hover:text-slate-700 sm:h-9 sm:w-9">
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
}
