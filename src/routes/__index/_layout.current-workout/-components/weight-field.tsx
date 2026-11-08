import { Info, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import type { BodyWeightEntry } from "@/lib/body-weight";
import { formatCalendarDate, formatWeight, formatWeightAmount, weightUnit } from "@/lib/format";
import { cn } from "@/lib/utils";
import { maxWeight, weightStep } from "@/lib/weight";
import { affixClass, fieldClass, noSpinClass } from "./field-class";

const unitClass = cn(affixClass, "right-3");

/**
 * The set form's Weight. A Body-weight Movement takes the Latest Body Weight, shown locked; with no
 * entry yet, the field asks for the body weight instead of a Weight.
 */
export function WeightField({
  isBodyWeight,
  latestBodyWeight,
  value,
  invalid,
  describedBy,
  onChange,
}: {
  isBodyWeight: boolean;
  latestBodyWeight: BodyWeightEntry | undefined;
  value: string;
  invalid: boolean;
  describedBy: string | undefined;
  onChange: (value: string) => void;
}) {
  if (isBodyWeight && latestBodyWeight) {
    return (
      <div className="relative">
        <Input
          readOnly
          aria-label="Body weight, from your latest entry"
          value={formatWeightAmount(latestBodyWeight.weight)}
          title={`Your latest body weight, from ${formatCalendarDate(latestBodyWeight.date)}`}
          className={cn(
            fieldClass,
            "cursor-default bg-slate-50 pr-14 text-slate-700 focus-visible:border-gray-300 focus-visible:ring-slate-300",
          )}
        />
        <span className={cn(unitClass, "flex items-center gap-1")}>
          {weightUnit}
          <Lock aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
      </div>
    );
  }

  const label = isBodyWeight ? "Body weight" : "Weight";
  return (
    <WeightInput
      label={label}
      placeholder={label}
      value={value}
      invalid={invalid}
      describedBy={describedBy}
      onChange={onChange}
    />
  );
}

/**
 * A pounds field with the unit beside it: the set's Weight and the Added Weight's amount. An invalid
 * value points at the message that explains it.
 */
export function WeightInput({
  label,
  placeholder,
  value,
  invalid,
  describedBy,
  onChange,
  autoFocus,
  className,
}: {
  label: string;
  placeholder: string;
  value: string;
  invalid: boolean;
  describedBy: string | undefined;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Input
        autoFocus={autoFocus}
        type="number"
        inputMode="decimal"
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? describedBy : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(fieldClass, noSpinClass, "pr-9", invalid && "border-red-300")}
        min={0}
        max={maxWeight}
        step={weightStep}
      />
      <span className={unitClass}>{weightUnit}</span>
    </div>
  );
}

/** Where a Body-weight Movement's Weight comes from, under the form's first row. */
export function BodyWeightNote({
  movementName,
  latestBodyWeight,
  className,
}: {
  movementName: string;
  latestBodyWeight: BodyWeightEntry | undefined;
  className?: string;
}) {
  if (latestBodyWeight) {
    return (
      <p className={cn("flex items-center gap-1.5 text-xs text-slate-500", className)}>
        <Lock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>
          {movementName} uses your latest body weight:{" "}
          <span className="font-medium tabular-nums text-slate-700">{formatWeight(latestBodyWeight.weight)}</span> from{" "}
          {formatCalendarDate(latestBodyWeight.date)}.
        </span>
      </p>
    );
  }

  // A note that stays while the movement is picked, not an urgent message: role="note" replaces the
  // primitive's role="alert", which would interrupt a screen reader every time it appears.
  return (
    <Alert variant="warning" role="note" className={className}>
      <Info aria-hidden="true" className="h-4 w-4" />
      <AlertDescription>
        No body weight recorded yet. Enter it as the weight: it's saved as today's body weight too.
      </AlertDescription>
    </Alert>
  );
}
