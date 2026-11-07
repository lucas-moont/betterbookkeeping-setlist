import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { movementsQueryOptions } from "@/lib/movements/queries";
import { MovementRow } from "./-components/movement-row";
import {
  filterOptions,
  matchesFilter,
  MuscleGroupFilter,
  type MuscleGroupFilterValue,
} from "./-components/muscle-group-filter";
import { NewMovementForm } from "./-components/new-movement-form";

export const Route = createFileRoute("/__index/_layout/movements/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(movementsQueryOptions());
  },
  component: MovementsPage,
});

function MovementsPage() {
  const { data: movements } = useSuspenseQuery(movementsQueryOptions());
  const [picked, setPicked] = useState<MuscleGroupFilterValue>("all");

  const options = filterOptions(movements);
  // Moving the last Movement out of the picked group removes that filter, so the list falls back to All.
  const filter = options.some((option) => option.value === picked) ? picked : "all";
  const shown = movements.filter((movement) => matchesFilter(movement, filter));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Movements</h1>

      <NewMovementForm />
      <Card>
        <CardHeader>
          <CardTitle>All Movements</CardTitle>
          <p className="text-sm text-slate-500">A workout's muscle groups come from the movements you log in it.</p>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-slate-500">No movements yet. Add one above!</p>
          ) : (
            <div className="space-y-3">
              <MuscleGroupFilter options={options} value={filter} onChange={setPicked} />
              <ul className="space-y-2">
                {shown.map((movement) => (
                  <MovementRow key={movement.id} movement={movement} />
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
