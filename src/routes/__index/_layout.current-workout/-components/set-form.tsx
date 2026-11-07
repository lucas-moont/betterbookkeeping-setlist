import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { weightUnit } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Movement } from "@/lib/movements";
import { maxWeight, weightStep } from "@/lib/weight";
import { addSetMutationOptions } from "@/lib/workouts/queries";
import { maxReps, maxSetCount } from "@/lib/workouts/set-draft";

/** How many sets one Add adds until the lifter picks another number. */
const defaultSetCount = "3";

const fieldClass = "h-11 text-base sm:h-10 sm:text-sm tabular-nums";

/** The number of sets the field asks for, or null while it holds something one Add can't take. */
function parseSetCount(value: string): number | null {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= maxSetCount ? count : null;
}

/** The form that adds one set, or several identical ones, to the Current Workout. */
export function SetForm({ movements }: { movements: Movement[] }) {
  const helpId = useId();
  const [selectedMovement, setSelectedMovement] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [count, setCount] = useState(defaultSetCount);

  const addSetMutation = useMutation({
    ...addSetMutationOptions(),
    // The next set is usually the same Movement and Weight with other Reps, so only Reps clear.
    onSuccess: () => {
      setReps("");
    },
  });

  const setsToAdd = parseSetCount(count);

  const handleAddSet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovement || !reps || !weight) return;
    addSetMutation.mutate({
      movementId: selectedMovement,
      reps: Number(reps),
      weight: Number(weight),
      count: setsToAdd ?? undefined,
    });
  };

  return (
    <form onSubmit={handleAddSet} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          aria-label="Movement"
          value={selectedMovement}
          onChange={(e) => setSelectedMovement(e.target.value)}
          className="h-11 text-base sm:h-10 sm:flex-1 sm:text-sm">
          <option value="">Select movement</option>
          {movements.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <div className="relative sm:w-32">
          <Input
            type="number"
            inputMode="decimal"
            aria-label="Weight"
            placeholder="Weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={cn(fieldClass, "pr-9")}
            min={0}
            max={maxWeight}
            step={weightStep}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            {weightUnit}
          </span>
        </div>
        {/* Reps and the number of sets share a row on a phone. */}
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <Input
            type="number"
            inputMode="numeric"
            aria-label="Reps"
            placeholder="Reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className={cn(fieldClass, "sm:w-24")}
            min={1}
            max={maxReps}
          />
          <div className="relative sm:w-28">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              ×
            </span>
            <Input
              type="number"
              inputMode="numeric"
              aria-label="Number of sets"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className={cn(fieldClass, "pl-7 pr-12 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")}
              min={1}
              max={maxSetCount}
              step={1}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              sets
            </span>
          </div>
        </div>
        <Button
          type="submit"
          aria-describedby={helpId}
          disabled={!selectedMovement || !reps || !weight}
          className="h-11 w-full text-base sm:h-10 sm:w-auto sm:text-sm">
          <Plus className="h-4 w-4" />
          {addSetMutation.isPending ? "Adding..." : setsToAdd && setsToAdd > 1 ? `Add ${setsToAdd} sets` : "Add"}
        </Button>
      </div>
      {/* Always on screen: a phone has no hover for a tooltip. */}
      <p id={helpId} className="text-sm text-slate-500">
        Each set you add counts as completed. Tap its circle to unmark a set you didn't do.
      </p>
    </form>
  );
}
