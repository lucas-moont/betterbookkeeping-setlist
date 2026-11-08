import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTimeZone } from "@/lib/time-zone";
import type { CompletedWorkout } from "@/lib/workouts";
import { deleteWorkoutsMutationOptions } from "@/lib/workouts/queries";
import { historyMovements } from "./workout-summary";
import { WorkoutRow } from "./workout-row";

/** The Completed Workouts table: one row per workout, one column per Movement, and bulk delete. */
export function CompletedWorkouts({ workouts }: { workouts: CompletedWorkout[] }) {
  const timeZone = useTimeZone();
  const [selectedWorkouts, setSelectedWorkouts] = useState<Set<string>>(new Set());

  const deleteWorkoutsMutation = useMutation({
    ...deleteWorkoutsMutationOptions(),
    onSuccess: () => {
      setSelectedWorkouts(new Set());
    },
  });

  const movements = historyMovements(workouts);

  const toggleWorkout = (id: string) => {
    setSelectedWorkouts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedWorkouts.size === workouts.length) {
      setSelectedWorkouts(new Set());
    } else {
      setSelectedWorkouts(new Set(workouts.map((w) => w.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedWorkouts.size === 0) return;
    deleteWorkoutsMutation.mutate(Array.from(selectedWorkouts));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Completed Workouts</CardTitle>
        <Button size="sm" variant="destructive" onClick={handleDeleteSelected} disabled={selectedWorkouts.size === 0}>
          <Trash2 className="w-4 h-4 mr-2" />
          {deleteWorkoutsMutation.isPending ? "Deleting..." : `Delete Selected (${selectedWorkouts.size})`}
        </Button>
      </CardHeader>
      <CardContent>
        {workouts.length === 0 ? (
          <p className="text-sm text-slate-500">No completed workouts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 px-4">
                    <input
                      aria-label="Select all workouts"
                      type="checkbox"
                      checked={selectedWorkouts.size === workouts.length}
                      onChange={toggleAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                  <th className="whitespace-nowrap text-left py-3 px-4 font-medium text-slate-600">Muscle groups</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Sets</th>
                  {movements.map((movement) => (
                    <th key={movement.id} className="whitespace-nowrap text-right py-3 px-4 font-medium text-slate-600">
                      {movement.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workouts.map((workout) => (
                  <WorkoutRow
                    key={workout.id}
                    workout={workout}
                    movements={movements}
                    timeZone={timeZone}
                    selected={selectedWorkouts.has(workout.id)}
                    onToggle={() => toggleWorkout(workout.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
