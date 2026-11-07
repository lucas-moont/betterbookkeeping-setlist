import { useMutation } from "@tanstack/react-query";
import type { Movement } from "@/lib/movements";
import { setMuscleGroupMutationOptions } from "@/lib/movements/queries";
import { MuscleGroupSelect } from "./muscle-group-select";

/** One Movement in the list: its name, the body-weight indicator, and its Muscle Group, changed in place. */
export function MovementRow({ movement }: { movement: Movement }) {
  const setMuscleGroupMutation = useMutation(setMuscleGroupMutationOptions());
  // The mutation stays pending until the list has refetched, so the select shows the group it sent
  // in the meantime instead of jumping back to the old one.
  const muscleGroup = setMuscleGroupMutation.isPending
    ? setMuscleGroupMutation.variables.muscleGroup
    : movement.muscleGroup;

  return (
    <li className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-slate-50 py-1.5 pl-3 pr-1.5 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span data-testid="movement-name" className="truncate font-medium text-slate-700">
          {movement.name}
        </span>
        {movement.isBodyWeight && <BodyWeightBadge />}
      </div>
      <MuscleGroupSelect
        aria-label={`Muscle group for ${movement.name}`}
        value={muscleGroup}
        onChange={(group) => setMuscleGroupMutation.mutate({ movementId: movement.id, muscleGroup: group })}
        className="w-40 shrink-0"
      />
    </li>
  );
}

/** Marks a Body-weight Movement. Neutral, not Chalk Rust: it is a fact about the row, not an action. */
function BodyWeightBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-600">
      Body-weight
    </span>
  );
}
