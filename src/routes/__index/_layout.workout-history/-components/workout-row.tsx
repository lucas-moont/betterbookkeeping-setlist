import type { ReactNode } from "react";
import { formatDate, formatWeight } from "@/lib/format";
import type { Movement } from "@/lib/movements";
import { muscleGroupLabels } from "@/lib/movements/muscle-group";
import { cn } from "@/lib/utils";
import type { CompletedWorkout } from "@/lib/workouts";
import { movementSummary, setCount, type SetCount } from "./workout-summary";

/**
 * One Completed Workout in the history table: its date, Muscle Groups, set count, and one cell per
 * Movement column. The numbers come from its Completed Sets only.
 */
export function WorkoutRow({
  workout,
  movements,
  timeZone,
  selected,
  onToggle,
}: {
  workout: CompletedWorkout;
  movements: Movement[];
  timeZone: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const date = formatDate(workout.completedAt, timeZone);

  return (
    <tr className={cn("border-b border-slate-100", selected ? "bg-primary/10" : "hover:bg-slate-50")}>
      <td className="py-3 px-4">
        <input
          aria-label={`Select workout from ${date}`}
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded border-gray-300"
        />
      </td>
      <td className="whitespace-nowrap py-3 px-4 text-slate-500">{date}</td>
      <td className="whitespace-nowrap py-3 px-4 text-slate-700">
        {workout.muscleGroups.length > 0 ? (
          workout.muscleGroups.map((group) => muscleGroupLabels[group]).join(", ")
        ) : (
          <Dash />
        )}
      </td>
      <td className="whitespace-nowrap py-3 px-4 text-right text-slate-600">
        <OutOf count={setCount(workout.sets)} />
      </td>
      {movements.map((movement) => (
        <MovementCell key={movement.id} workout={workout} movementId={movement.id} />
      ))}
    </tr>
  );
}

function MovementCell({ workout, movementId }: { workout: CompletedWorkout; movementId: string }) {
  const summary = movementSummary(workout.sets, movementId);
  if (!summary) {
    return (
      <td className="py-3 px-4 text-right">
        <Dash />
      </td>
    );
  }
  const unit = summary.total === 1 ? "set" : "sets";
  // Every set of this Movement was left planned: nothing to measure, only what was skipped, quietly.
  if (summary.heaviestLoad === undefined) {
    return (
      <td className="whitespace-nowrap py-3 px-4 text-right text-slate-500">
        0 of {summary.total} {unit}
      </td>
    );
  }
  const sets = (
    <>
      <OutOf count={summary} /> {unit}
    </>
  );
  return (
    <td className="whitespace-nowrap py-3 px-4 text-right text-slate-600">
      {formatWeight(summary.heaviestLoad)} / {summary.averageReps} reps / {sets}
    </td>
  );
}

/** "3" when every set was done, "2 of 3" in bold when some were left planned. */
function OutOf({ count }: { count: SetCount }): ReactNode {
  if (count.completed === count.total) return count.total;
  return (
    <span className="font-medium text-slate-900">
      {count.completed} of {count.total}
    </span>
  );
}

function Dash() {
  return <span className="text-slate-300">-</span>;
}
