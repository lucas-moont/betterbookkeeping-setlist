import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Movement } from "@/lib/movements";
import { isFormError } from "@/lib/server-mutation";
import type { MuscleGroup } from "@/lib/movements/muscle-group";
import { movementNameMaxLength, movementNameSchema } from "@/lib/movements/name";
import { updateMovementMutationOptions } from "@/lib/movements/queries";
import { BodyWeightCheckbox } from "./body-weight-checkbox";
import { MuscleGroupSelect } from "./muscle-group-select";

interface EditMovementDialogProps {
  movement: Movement;
  open: boolean;
  onClose: () => void;
}

/** Edits a Movement's name, Muscle Group and body-weight flag in one place. A Movement can't be deleted. */
export function EditMovementDialog({ movement, open, onClose }: EditMovementDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit movement"
      description="Changing Body-weight only affects the sets you log from now on.">
      <EditMovementForm movement={movement} onDone={onClose} />
    </Dialog>
  );
}

// Mounted each time the dialog opens, so it starts from the Movement as it is now.
function EditMovementForm({ movement, onDone }: { movement: Movement; onDone: () => void }) {
  const [name, setName] = useState(movement.name);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(movement.muscleGroup);
  const [isBodyWeight, setIsBodyWeight] = useState(movement.isBodyWeight);

  const updateMovementOptions = updateMovementMutationOptions();
  const updateMovementMutation = useMutation({ ...updateMovementOptions, onSuccess: onDone });
  // A taken name shows under the field, like the new movement form; anything else gets the toast.
  const { error } = updateMovementMutation;
  const nameError = isFormError(error, updateMovementOptions.meta) ? (error?.message ?? "") : "";
  const canSubmit = movementNameSchema.safeParse(name).success && !updateMovementMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    updateMovementMutation.mutate({ movementId: movement.id, name, muscleGroup, isBodyWeight });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="edit-movement-name" className="text-sm font-medium text-gray-700">
          Name
        </label>
        <Input
          id="edit-movement-name"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "edit-movement-name-error" : undefined}
          value={name}
          maxLength={movementNameMaxLength}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) updateMovementMutation.reset();
          }}
          className={cn("h-11 text-base sm:h-10 sm:text-sm", nameError && "border-red-300")}
        />
        {nameError && (
          <p id="edit-movement-name-error" role="alert" className="text-sm text-red-600">
            {nameError}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="edit-movement-muscle-group" className="text-sm font-medium text-gray-700">
          Muscle group
        </label>
        <MuscleGroupSelect id="edit-movement-muscle-group" value={muscleGroup} onChange={setMuscleGroup} />
      </div>
      <BodyWeightCheckbox checked={isBodyWeight} onChange={setIsBodyWeight} />
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone} className="h-11 text-base sm:h-10 sm:text-sm">
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit} className="h-11 text-base sm:h-10 sm:text-sm">
          {updateMovementMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
