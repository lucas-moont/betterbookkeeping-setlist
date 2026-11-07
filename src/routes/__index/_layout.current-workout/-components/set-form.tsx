import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Movement } from "@/lib/movements";
import { maxWeight, weightStep } from "@/lib/weight";
import { addSetMutationOptions } from "@/lib/workouts/queries";
import { maxReps } from "@/lib/workouts/set-draft";

/** The form that adds a set to the Current Workout. */
export function SetForm({ movements }: { movements: Movement[] }) {
  const [selectedMovement, setSelectedMovement] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");

  const addSetMutation = useMutation({
    ...addSetMutationOptions(),
    onSuccess: () => {
      setReps("");
    },
  });

  const handleAddSet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovement || !reps || !weight) return;
    addSetMutation.mutate({
      movementId: selectedMovement,
      reps: Number(reps),
      weight: Number(weight),
    });
  };

  return (
    <form onSubmit={handleAddSet} className="flex gap-2 items-center">
      <Select aria-label="Movement" value={selectedMovement} onChange={(e) => setSelectedMovement(e.target.value)}>
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
  );
}
