import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatWeight } from "@/lib/format";
import type { WorkoutSet } from "@/lib/workouts";
import { removeSetMutationOptions } from "@/lib/workouts/queries";

/** The sets of the Current Workout, in the order they were added. */
export function SetList({ sets }: { sets: WorkoutSet[] }) {
  const removeSetMutation = useMutation(removeSetMutationOptions());

  if (sets.length === 0) {
    return <p className="text-sm text-slate-500">No sets yet. Add exercises to your workout!</p>;
  }

  return (
    <ul className="space-y-2">
      {sets.map((set) => (
        <li key={set.id} className="px-3 py-2 bg-slate-50 rounded-lg text-sm flex items-center justify-between">
          <div>
            <span className="font-medium">{set.movement.name}</span>
            <span className="text-slate-500 ml-2">
              {set.reps} reps × {formatWeight(set.weight)}
            </span>
          </div>
          <Button
            aria-label="Remove set"
            variant="ghost"
            size="icon"
            onClick={() => removeSetMutation.mutate(set.id)}
            className="h-8 w-8 text-slate-400">
            <X className="w-4 h-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
