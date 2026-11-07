import { useId } from "react";
import { useMutation } from "@tanstack/react-query";
import { Circle, CircleCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatWeight } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WorkoutSet } from "@/lib/workouts";
import { removeSetMutationOptions, setCompletedMutationOptions } from "@/lib/workouts/queries";
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
          <SetRow key={set.id} set={set} number={index + 1} movementName={movement.name} />
        ))}
      </ul>
    </section>
  );
}

/**
 * One set: the circle that marks it completed or planned, its number within the Movement, Reps and
 * Weight, and the button that removes it. A Planned Set has a dashed outline and greyed text.
 */
function SetRow({ set, number, movementName }: { set: WorkoutSet; number: number; movementName: string }) {
  const removeSetMutation = useMutation(removeSetMutationOptions());
  const setCompletedMutation = useMutation(setCompletedMutationOptions());
  // The mutation stays pending until the workout has refetched, so the circle shows the state it
  // sent in the meantime instead of jumping back.
  const completed = setCompletedMutation.isPending ? setCompletedMutation.variables.completed : set.completed;
  const { composition, note } = weightParts(set);

  return (
    <li
      className={cn(
        "flex min-h-11 items-center gap-1 rounded-lg border py-0.5 pr-1 text-sm sm:min-h-9",
        completed ? "border-transparent bg-slate-50" : "border-dashed border-slate-300 bg-white",
      )}>
      <button
        type="button"
        role="checkbox"
        aria-checked={completed}
        aria-label={`Completed: ${movementName}, set ${number}, ${set.load < 0 ? composition : formatWeight(set.load)} × ${set.reps}`}
        onClick={() => setCompletedMutation.mutate({ setId: set.id, completed: !completed })}
        className={cn(
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors sm:h-9 sm:w-9",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          completed ? "text-primary hover:bg-primary/5" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
        )}>
        {completed ? <CircleCheck className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      </button>
      <span className={cn("min-w-0 flex-1 tabular-nums", completed ? "text-slate-700" : "text-slate-500")}>
        <span className="mr-1 text-slate-500">Set {number}</span>{" "}
        {/* One unit: a narrow row wraps before the note, never inside "172.4 lb + 25 lb". */}
        <span className="whitespace-nowrap">
          {set.reps} reps × {composition}
        </span>
        {note && (
          <>
            {" "}
            <span className="text-slate-500">({note})</span>
          </>
        )}
      </span>
      <Button
        aria-label="Remove set"
        variant="ghost"
        size="icon"
        onClick={() => removeSetMutation.mutate(set.id)}
        className="h-11 w-11 shrink-0 text-slate-500 hover:text-slate-700 sm:h-9 sm:w-9">
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
}

/**
 * A set's Weight as the row shows it. A body-weight set with an Added Weight shows both parts, its
 * body weight then the extra load or the assistance: "172.4 lb + 25 lb", with the note apart.
 */
function weightParts(set: WorkoutSet): { composition: string; note: string | null } {
  if (set.addedWeight === null) return { composition: formatWeight(set.weight), note: null };
  const sign = set.addedWeight < 0 ? "−" : "+";
  return {
    composition: `${formatWeight(set.weight)} ${sign} ${formatWeight(Math.abs(set.addedWeight))}`,
    note: set.addedWeightNote,
  };
}
