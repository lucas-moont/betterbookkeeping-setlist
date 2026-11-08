import { useRef } from "react";
import { flushSync } from "react-dom";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { errorMessages } from "@/lib/error-codes";
import { formatWeight, weightUnitName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { load } from "@/lib/weight";
import { maxAddedWeightNoteLength } from "@/lib/workouts/set-draft";
import { fieldClass } from "./field-class";
import { WeightInput } from "./weight-field";

/** The Added Weight a lifter is typing: extra load (+1) or assistance (-1), how much, and how. */
export type AddedWeightDraft = { open: boolean; sign: 1 | -1; amount: string; note: string };

export const noAddedWeight: AddedWeightDraft = { open: false, sign: 1, amount: "", note: "" };

export type AddedWeightErrors = { amount?: string; note?: string };

/**
 * The open row as the set draft takes it: the signed amount (none while the field is empty) and the
 * note as typed. setDraftSchema decides what is valid, so the form and the server share one rule.
 */
export function addedWeightFields(draft: AddedWeightDraft): { addedWeight?: number; addedWeightNote: string } {
  return {
    addedWeight: draft.amount === "" ? undefined : draft.sign * Number(draft.amount),
    addedWeightNote: draft.note,
  };
}

/**
 * The server refuses assistance above the body weight, since Load is never negative. The form checks
 * it first because it knows the body weight, and says it in the message.
 */
export function assistanceError(bodyWeight: number, addedWeight: number): string | undefined {
  if (load({ weight: bodyWeight, addedWeight }) >= 0) return undefined;
  return `${errorMessages["assistance-exceeds-body-weight"]} (${formatWeight(bodyWeight)}).`;
}

const signs: SegmentedOption<1 | -1>[] = [
  { value: 1, label: "Extra", icon: Plus },
  { value: -1, label: "Assistance", icon: Minus },
];

/**
 * A Body-weight Movement's Added Weight: a button until the lifter asks for one, then the row with
 * the type, the amount and the required description.
 */
export function AddedWeight({
  draft,
  errors,
  describedBy,
  onChange,
  className,
}: {
  draft: AddedWeightDraft;
  errors: AddedWeightErrors;
  describedBy: string | undefined;
  onChange: (draft: AddedWeightDraft) => void;
  className?: string;
}) {
  const openButton = useRef<HTMLButtonElement>(null);

  if (!draft.open) {
    return (
      <div className={className}>
        <Button
          ref={openButton}
          type="button"
          variant="ghost"
          onClick={() => onChange({ ...draft, open: true })}
          className="-ml-2 h-11 px-2 text-base text-slate-600 sm:h-8 sm:text-sm">
          <Plus className="h-4 w-4" />
          Added weight
        </Button>
      </div>
    );
  }

  const close = () => {
    // Back to the button that opened the row, so the keyboard doesn't lose its place.
    flushSync(() => onChange(noAddedWeight));
    openButton.current?.focus();
  };

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <SegmentedControl
        label="Added weight type"
        options={signs}
        value={draft.sign}
        onChange={(sign) => onChange({ ...draft, sign })}
      />
      <WeightInput
        autoFocus
        label={`Added weight in ${weightUnitName}`}
        placeholder="Amount"
        value={draft.amount}
        invalid={errors.amount !== undefined}
        describedBy={describedBy}
        onChange={(amount) => onChange({ ...draft, amount })}
        className="sm:w-28"
      />
      <Input
        aria-label="Description of the added weight"
        aria-invalid={errors.note ? true : undefined}
        aria-describedby={errors.note ? describedBy : undefined}
        placeholder={draft.sign < 0 ? "e.g. resistance band" : "e.g. weighted vest"}
        maxLength={maxAddedWeightNoteLength}
        value={draft.note}
        onChange={(e) => onChange({ ...draft, note: e.target.value })}
        className={cn(fieldClass, "sm:flex-1", errors.note && "border-red-300")}
      />
      <Button
        type="button"
        variant="ghost"
        aria-label="Remove added weight"
        onClick={close}
        className="h-11 text-base text-slate-500 hover:text-slate-700 sm:h-10 sm:w-10 sm:px-0 sm:text-sm">
        <X className="h-4 w-4" />
        <span className="sm:hidden">Remove added weight</span>
      </Button>
    </div>
  );
}
