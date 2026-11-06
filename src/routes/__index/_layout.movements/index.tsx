import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { isFormError } from "@/lib/server-mutation";
import { movementNameMaxLength, movementNameSchema } from "@/lib/movements/name";
import { createMovementMutationOptions, movementsQueryOptions } from "@/lib/movements/queries";

export const Route = createFileRoute("/__index/_layout/movements/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(movementsQueryOptions());
  },
  component: MovementsPage,
});

function MovementsPage() {
  const { data: movements } = useSuspenseQuery(movementsQueryOptions());
  const [name, setName] = useState("");

  const createMovementOptions = createMovementMutationOptions();
  const createMovementMutation = useMutation({
    ...createMovementOptions,
    onSuccess: () => {
      setName("");
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
    createMovementMutation.mutate(name);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Movements</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add New Movement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex gap-3">
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
                className={cn("flex-1", nameError && "border-red-300")}
              />
              <Button type="submit" disabled={!canSubmit}>
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
      <Card>
        <CardHeader>
          <CardTitle>All Movements</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-slate-500">No movements yet. Add one above!</p>
          ) : (
            <ul className="space-y-2">
              {movements.map((movement) => (
                <li key={movement.id} className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-700">
                  {movement.name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
