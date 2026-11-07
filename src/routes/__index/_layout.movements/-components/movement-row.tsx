import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Movement } from "@/lib/movements";
import { setMuscleGroupMutationOptions } from "@/lib/movements/queries";
import { EditMovementDialog } from "./edit-movement-dialog";
import { MuscleGroupSelect } from "./muscle-group-select";

/**
 * One Movement in the list: its name, the body-weight indicator, its Muscle Group, changed in place,
 * and the button that opens the edit dialog. Both write through the same movements.update.
 */
export function MovementRow({ movement }: { movement: Movement }) {
  const [editing, setEditing] = useState(false);
  const setMuscleGroupMutation = useMutation(setMuscleGroupMutationOptions());
  // The mutation stays pending until the list has refetched, so the select shows the group it sent
  // in the meantime instead of jumping back to the old one.
  const muscleGroup = setMuscleGroupMutation.isPending
    ? setMuscleGroupMutation.variables.muscleGroup
    : movement.muscleGroup;

  return (
    // On a narrow screen the controls wrap under the name instead of squeezing it.
    <li className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-slate-50 py-1.5 pl-3 pr-1.5 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span data-testid="movement-name" className="truncate font-medium text-slate-700">
          {movement.name}
        </span>
        {movement.isBodyWeight && <BodyWeightBadge />}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <MuscleGroupSelect
          aria-label={`Muscle group for ${movement.name}`}
          value={muscleGroup}
          onChange={(group) => setMuscleGroupMutation.mutate({ movementId: movement.id, muscleGroup: group })}
          className="w-40"
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${movement.name}`}
          onClick={() => setEditing(true)}
          className="h-11 w-11 text-slate-400 hover:text-slate-700 sm:h-9 sm:w-9">
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
      <EditMovementDialog movement={movement} open={editing} onClose={() => setEditing(false)} />
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
