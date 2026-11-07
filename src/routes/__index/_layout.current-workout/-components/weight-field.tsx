import { Info, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { BodyWeightEntry } from "@/lib/body-weight";
import { formatCalendarDate, formatWeight, weightUnit } from "@/lib/format";
import { cn } from "@/lib/utils";
import { maxWeight, weightStep } from "@/lib/weight";
import { fieldClass } from "./field-class";

const unitClass = "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400";

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
          value={String(latestBodyWeight.weight)}
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
    <div className="relative">
      <Input
        type="number"
        inputMode="decimal"
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? describedBy : undefined}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(fieldClass, "pr-9", invalid && "border-red-300")}
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

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800",
        className,
      )}>
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <p>No body weight recorded yet. Enter it as the weight: it's saved as today's body weight too.</p>
    </div>
  );
}
