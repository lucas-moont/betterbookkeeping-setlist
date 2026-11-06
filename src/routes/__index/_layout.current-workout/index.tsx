import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Play, Check, Plus, X } from "lucide-react";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import {
  addSetMutationOptions,
  completeWorkoutMutationOptions,
  currentWorkoutQueryOptions,
  removeSetMutationOptions,
  startWorkoutMutationOptions,
} from "@/lib/workouts/queries";
import { movementsQueryOptions } from "@/lib/movements/queries";
import { formatWeight } from "@/lib/format";
import { maxWeight, weightStep } from "@/lib/weight";
import { maxReps } from "@/lib/workouts/set-draft";

export const Route = createFileRoute("/__index/_layout/current-workout/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(currentWorkoutQueryOptions()),
      context.queryClient.ensureQueryData(movementsQueryOptions()),
    ]);
  },
  component: CurrentWorkoutPage,
});

function CurrentWorkoutPage() {
  const { data: workout } = useSuspenseQuery(currentWorkoutQueryOptions());
  const { data: movements } = useSuspenseQuery(movementsQueryOptions());
  const [selectedMovement, setSelectedMovement] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");

  const startWorkoutMutation = useMutation(startWorkoutMutationOptions());

  const completeWorkoutMutation = useMutation(completeWorkoutMutationOptions());

  const addSetMutation = useMutation({
    ...addSetMutationOptions(),
    onSuccess: () => {
      setReps("");
    },
  });

  const removeSetMutation = useMutation(removeSetMutationOptions());

  const handleAddSet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovement || !reps || !weight) return;
    addSetMutation.mutate({
      movementId: selectedMovement,
      reps: Number(reps),
      weight: Number(weight),
    });
  };

  if (!workout) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-900">Current Workout</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 mb-4">No active workout. Ready to start?</p>
            <Button onClick={() => startWorkoutMutation.mutate()} size="lg">
              <Play className="w-4 h-4 mr-2" />
              {startWorkoutMutation.isPending ? "Starting..." : "Start Workout"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Current Workout</h1>
        <Button variant="outline" onClick={() => completeWorkoutMutation.mutate()}>
          <Check className="w-4 h-4 mr-2" />
          {completeWorkoutMutation.isPending ? "Completing..." : "Complete Workout"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddSet} className="flex gap-2 items-center">
            <Select
              aria-label="Movement"
              value={selectedMovement}
              onChange={(e) => setSelectedMovement(e.target.value)}>
              <option value="">Select movement</option>
              {movements.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              aria-label="Weight"
              placeholder="Weight"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-24"
              min={0}
              max={maxWeight}
              step={weightStep}
            />
            <Input
              type="number"
              aria-label="Reps"
              placeholder="Reps"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-24"
              min={1}
              max={maxReps}
            />
            <Button type="submit" disabled={!selectedMovement || !reps || !weight} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              {addSetMutation.isPending ? "Adding..." : "Add"}
            </Button>
          </form>
          {workout.sets.length === 0 ? (
            <p className="text-sm text-slate-500">No sets yet. Add exercises to your workout!</p>
          ) : (
            <ul className="space-y-2">
              {workout.sets.map((set) => (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
