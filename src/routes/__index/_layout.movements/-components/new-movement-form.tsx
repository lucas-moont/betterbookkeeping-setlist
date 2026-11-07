import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isFormError } from "@/lib/server-mutation";
import type { MuscleGroup } from "@/lib/movements/muscle-group";
import { movementNameMaxLength, movementNameSchema } from "@/lib/movements/name";
import { createMovementMutationOptions } from "@/lib/movements/queries";
import { BodyWeightCheckbox } from "./body-weight-checkbox";
import { MuscleGroupSelect } from "./muscle-group-select";

export function NewMovementForm() {
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [isBodyWeight, setIsBodyWeight] = useState(false);

  const createMovementOptions = createMovementMutationOptions();
  const createMovementMutation = useMutation({
    ...createMovementOptions,
    onSuccess: () => {
      setName("");
      setMuscleGroup(null);
      setIsBodyWeight(false);
    },
  });
  // A refused name (the mutation's formErrors) shows under the field, and the typed name stays so
  // the user can fix it. Every other error gets the global toast instead.
  const { error } = createMovementMutation;
  const nameError = isFormError(error, createMovementOptions.meta) ? (error?.message ?? "") : "";
  const canSubmit = movementNameSchema.safeParse(name).success;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMovementMutation.mutate({ name, muscleGroup, isBodyWeight });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Movement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Input
              aria-label="Movement name"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "movement-name-error" : undefined}
              placeholder="Movement name (e.g. Bench Press)"
              value={name}
              maxLength={movementNameMaxLength}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) createMovementMutation.reset();
              }}
              className={cn("h-11 text-base sm:h-10 sm:flex-1 sm:text-sm", nameError && "border-red-300")}
            />
            <MuscleGroupSelect
              aria-label="Muscle group"
              value={muscleGroup}
              onChange={setMuscleGroup}
              className="sm:w-48"
            />
            <BodyWeightCheckbox checked={isBodyWeight} onChange={setIsBodyWeight} className="sm:px-1" />
            <Button type="submit" disabled={!canSubmit} className="h-11 text-base sm:h-10 sm:text-sm">
              <Plus className="h-4 w-4" />
              {createMovementMutation.isPending ? "Adding..." : "Add"}
            </Button>
          </div>
          {nameError && (
            <p id="movement-name-error" role="alert" className="text-sm text-red-600">
              {nameError}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
