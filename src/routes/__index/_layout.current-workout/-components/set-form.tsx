import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { BodyWeightEntry } from "@/lib/body-weight";
import { formatWeight } from "@/lib/format";
import type { Movement } from "@/lib/movements";
import { ServerResultError } from "@/lib/error-codes";
import { isFormError } from "@/lib/server-mutation";
import { cn } from "@/lib/utils";
import { addSetMutationOptions } from "@/lib/workouts/queries";
import { maxReps, maxSetCount, setDraftSchema, type SetDraft } from "@/lib/workouts/set-draft";
import { AddedWeight, addedWeightFields, assistanceError, noAddedWeight } from "./added-weight";
import { BodyWeightNote, WeightField } from "./weight-field";
import { affixClass, fieldClass, noSpinClass } from "./field-class";

/** How many sets one Add adds until the lifter picks another number. */
const defaultSetCount = "3";

/** The number of sets the field asks for, or null while it holds something one Add can't take. */
function parseSetCount(value: string): number | null {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= maxSetCount ? count : null;
}

/** What the form shows next to each field of the draft, one message per field. */
type DraftErrors = Partial<Record<keyof SetDraft, string>>;

/** The draft's fields in the order the form shows them, so the messages read top to bottom. */
const fieldOrder: (keyof SetDraft)[] = ["movementId", "weight", "reps", "count", "addedWeight", "addedWeightNote"];

function errorsByField(issues: readonly { path: readonly PropertyKey[]; message: string }[]): DraftErrors {
  const errors: DraftErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as keyof SetDraft;
    errors[field] ??= issue.message;
  }
  return errors;
}

/**
 * The form that adds one set, or several identical ones, to the Current Workout. For a Body-weight
 * Movement the Weight is the Latest Body Weight, locked; with none yet, the lifter types it and the
 * server also saves it as today's Body Weight Entry (ADR 0003).
 */
export function SetForm({
  movements,
  latestBodyWeight,
}: {
  movements: Movement[];
  latestBodyWeight: BodyWeightEntry | undefined;
}) {
  const helpId = useId();
  const messageId = useId();
  const [selectedMovement, setSelectedMovement] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [count, setCount] = useState(defaultSetCount);
  const [added, setAdded] = useState(noAddedWeight);
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});
  // The confirmation of the last add, when it also saved a body weight.
  const [notice, setNotice] = useState<string | null>(null);

  const addSetOptions = addSetMutationOptions();
  const addSetMutation = useMutation({
    ...addSetOptions,
    // The next set is usually the same Movement and Weight with other Reps, so only Reps clear.
    onSuccess: ({ recordedBodyWeight }) => {
      setReps("");
      if (recordedBodyWeight) {
        setNotice(`Set added. ${formatWeight(recordedBodyWeight.weight)} is also saved as today's body weight.`);
      }
    },
  });
  // A refused body weight or added weight (the mutation's formErrors) shows under the form, and the
  // typed values stay so the lifter can fix them. Every other error gets the global toast.
  const { error } = addSetMutation;
  const formError = error instanceof ServerResultError && isFormError(error, addSetOptions.meta) ? error : null;
  const clearMessages = () => {
    setNotice(null);
    if (formError) addSetMutation.reset();
  };

  const movement = movements.find((m) => m.id === selectedMovement);
  const isBodyWeight = movement?.isBodyWeight ?? false;
  const lockedWeight = isBodyWeight ? latestBodyWeight : undefined;
  const setsToAdd = parseSetCount(count);
  const canSubmit = !!movement && reps !== "" && (lockedWeight !== undefined || weight !== "");

  const handleAddSet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movement || !canSubmit) return;
    setNotice(null);
    // The server takes a Body-weight Movement's Weight from the Latest Body Weight itself.
    const weightToSend = lockedWeight ? lockedWeight.weight : Number(weight);
    // The same schema the server validates with, so the form refuses what the server would.
    const parsed = setDraftSchema.safeParse({
      movementId: movement.id,
      reps: Number(reps),
      weight: weightToSend,
      count: setsToAdd ?? undefined,
      ...(isBodyWeight && added.open ? addedWeightFields(added) : {}),
    });
    if (!parsed.success) {
      setDraftErrors(errorsByField(parsed.error.issues));
      addSetMutation.reset();
      return;
    }
    const { addedWeight } = parsed.data;
    const assistance = addedWeight === undefined ? undefined : assistanceError(weightToSend, addedWeight);
    if (assistance) {
      setDraftErrors({ addedWeight: assistance });
      addSetMutation.reset();
      return;
    }
    setDraftErrors({});
    addSetMutation.mutate(parsed.data);
  };

  // What to fix, the form's own checks first, then what the server refused.
  const amountError =
    draftErrors.addedWeight ??
    (formError?.code === "assistance-exceeds-body-weight" ? formError.message : undefined);
  const messages = [
    ...new Set([...fieldOrder.map((field) => draftErrors[field]), formError?.message].filter(Boolean)),
  ];

  return (
    <form
      aria-label="Add a set"
      onSubmit={handleAddSet}
      className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_6rem_7rem_auto] sm:items-center">
      <Select
        aria-label="Movement"
        value={selectedMovement}
        onChange={(e) => {
          setSelectedMovement(e.target.value);
          clearMessages();
        }}
        className="h-11 text-base sm:h-10 sm:text-sm">
        <option value="">Select movement</option>
        {movements.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </Select>
      <WeightField
        isBodyWeight={isBodyWeight}
        latestBodyWeight={latestBodyWeight}
        value={weight}
        invalid={draftErrors.weight !== undefined || formError?.code === "body-weight-required"}
        describedBy={messageId}
        onChange={(value) => {
          setWeight(value);
          clearMessages();
        }}
      />
      {/* Reps and the number of sets share a row on a phone. */}
      <div className="grid grid-cols-2 gap-2 sm:contents">
        <Input
          type="number"
          inputMode="numeric"
          aria-label="Reps"
          placeholder="Reps"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className={cn(fieldClass, noSpinClass)}
          min={1}
          max={maxReps}
        />
        <div className="relative">
          <span
            aria-hidden="true"
            className={cn(affixClass, "left-3")}>
            ×
          </span>
          <Input
            type="number"
            inputMode="numeric"
            aria-label="Number of sets"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className={cn(fieldClass, noSpinClass, "pl-7 pr-12")}
            min={1}
            max={maxSetCount}
            step={1}
          />
          <span
            aria-hidden="true"
            className={cn(affixClass, "right-3")}>
            sets
          </span>
        </div>
      </div>
      {movement && isBodyWeight && (
        <>
          <BodyWeightNote
            movementName={movement.name}
            latestBodyWeight={latestBodyWeight}
            className="sm:col-span-full"
          />
          <AddedWeight
            draft={added}
            errors={{ amount: amountError, note: draftErrors.addedWeightNote }}
            describedBy={messageId}
            onChange={(draft) => {
              setAdded(draft);
              setDraftErrors({});
              clearMessages();
            }}
            className="sm:col-span-full"
          />
        </>
      )}
      {messages.length > 0 && (
        <div id={messageId} role="alert" className="space-y-0.5 sm:col-span-full">
          {messages.map((message) => (
            <p key={message} className="text-sm text-red-600">
              {message}
            </p>
          ))}
        </div>
      )}
      {/* Last in the form on a phone; at the end of the first row from sm up. */}
      <Button
        type="submit"
        aria-describedby={helpId}
        disabled={!canSubmit}
        className="h-11 w-full text-base sm:col-start-5 sm:row-start-1 sm:h-10 sm:w-auto sm:text-sm">
        <Plus className="h-4 w-4" />
        {addSetMutation.isPending ? "Adding..." : setsToAdd && setsToAdd > 1 ? `Add ${setsToAdd} sets` : "Add"}
      </Button>
      <div className="sm:col-span-full">
        {/* Always mounted, so a screen reader announces the text when it changes. Here and not in the
            grid, where even an empty row would add a gap. */}
        <p role="status" className={cn("text-sm text-slate-500", notice && "mb-2")}>
          {notice}
        </p>
        {/* Always on screen: a phone has no hover for a tooltip. */}
        <p id={helpId} className="text-sm text-slate-500">
          Each set you add counts as completed. Tap its circle to unmark a set you didn't do.
        </p>
      </div>
    </form>
  );
}
