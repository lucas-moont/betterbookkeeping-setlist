import { useForm, useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bodyWeightSchema } from "@/lib/body-weight/entry";
import type { BodyWeightEntry } from "@/lib/body-weight";
import { recordBodyWeightMutationOptions } from "@/lib/body-weight/queries";
import { errorMessages } from "@/lib/error-codes";
import { formatCalendarDate, formatWeight, weightUnit, weightUnitName } from "@/lib/format";
import { isoDateSchema } from "@/lib/iso-date";
import { isFormError } from "@/lib/server-mutation";
import { cn } from "@/lib/utils";
import { maxWeight, weightStep } from "@/lib/weight";

type BodyWeightFormProps = {
  /** The user's entries, to tell whether the picked date already has one. */
  entries: BodyWeightEntry[];
  /** The user's today as "YYYY-MM-DD": the default date and the latest one allowed. */
  today: string;
  /** The confirmation of the last action, owned by the page so a delete in the list can set it too. */
  notice: string | null;
  onNotice: (notice: string | null) => void;
};

// The same rules as the server (bodyWeightEntrySchema), plus the user's today, which only the screen
// and the module know. Each returns the message the field shows, or undefined.
function dateError(value: string, today: string): string | undefined {
  if (value === "") return "Pick a date";
  const result = isoDateSchema.safeParse(value);
  if (!result.success) return result.error.issues[0]?.message;
  if (value > today) return errorMessages["body-weight-date-in-future"];
}

function weightError(value: string): string | undefined {
  if (value.trim() === "") return "Enter your body weight";
  const result = bodyWeightSchema.safeParse(Number(value));
  if (!result.success) return result.error.issues[0]?.message;
}

/**
 * Records a body weight for a date, today by default. A date that already has an entry says so before
 * the user submits, and the button reads "Replace": recording again replaces it (CONTEXT.md).
 */
export function BodyWeightForm({ entries, today, notice, onNotice }: BodyWeightFormProps) {
  const recordOptions = recordBodyWeightMutationOptions();
  const recordMutation = useMutation(recordOptions);
  // A future date the server refused shows under the date field; anything else gets the toast.
  const serverDateError = isFormError(recordMutation.error, recordOptions.meta)
    ? recordMutation.error?.message
    : undefined;

  const form = useForm({
    defaultValues: { date: today, weight: "" },
    onSubmit: async ({ value, formApi }) => {
      const weight = Number(value.weight);
      const replaced = entries.some((entry) => entry.date === value.date);
      await recordMutation.mutateAsync({ date: value.date, weight });
      const day = formatCalendarDate(value.date);
      onNotice(replaced ? `Replaced the entry for ${day}.` : `Recorded ${formatWeight(weight)} for ${day}.`);
      formApi.reset();
    },
  });

  const date = useStore(form.store, (state) => state.values.date);
  const existing = entries.find((entry) => entry.date === date);
  // Right after an action its confirmation wins: the form is back on today, which may be the date just
  // recorded, and that must not read as a warning. The notice clears once the user edits a field.
  const willReplace = !notice && existing !== undefined;

  // Field errors show under the whole row, where the notices also go, so a long message never wraps
  // inside a narrow field's column. An error waits until its field was touched (or a submit tried).
  const dateFieldError =
    useStore(form.store, (state) => (state.fieldMeta.date?.isTouched ? state.fieldMeta.date.errors[0] : undefined)) ||
    serverDateError;
  const weightFieldError = useStore(form.store, (state) =>
    state.fieldMeta.weight?.isTouched ? state.fieldMeta.weight.errors[0] : undefined,
  );

  const clearMessages = () => {
    if (notice) onNotice(null);
    if (recordMutation.error) recordMutation.reset();
  };

  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit().catch(() => {
          // The mutation's error is already on screen: under the form row or in the toast.
        });
      }}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <form.Field name="date" validators={{ onChange: ({ value }) => dateError(value, today) }}>
          {(field) => {
            const error = dateFieldError;
            return (
              <div className="sm:w-44">
                <Input
                  type="date"
                  aria-label="Date"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "body-weight-date-error" : undefined}
                  name={field.name}
                  value={field.state.value}
                  max={today}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    clearMessages();
                  }}
                  onBlur={field.handleBlur}
                  className={cn("tabular-nums", error && "border-red-300")}
                />
              </div>
            );
          }}
        </form.Field>
        <form.Field name="weight" validators={{ onChange: ({ value }) => weightError(value) }}>
          {(field) => {
            const error = weightFieldError;
            return (
              <div className="sm:w-36">
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    aria-label={`Weight in ${weightUnitName}`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "body-weight-weight-error" : undefined}
                    placeholder="Weight"
                    name={field.name}
                    value={field.state.value}
                    min={weightStep}
                    max={maxWeight}
                    step={weightStep}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                      clearMessages();
                    }}
                    onBlur={field.handleBlur}
                    className={cn("pr-9 tabular-nums", error && "border-red-300")}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    {weightUnit}
                  </span>
                </div>
              </div>
            );
          }}
        </form.Field>
        <Button type="submit" disabled={recordMutation.isPending}>
          <Plus className="w-4 h-4" />
          {recordMutation.isPending ? "Recording..." : willReplace ? "Replace" : "Record"}
        </Button>
      </div>
      {dateFieldError && (
        <p id="body-weight-date-error" role="alert" className="text-sm text-red-600">
          {dateFieldError}
        </p>
      )}
      {weightFieldError && (
        <p id="body-weight-weight-error" role="alert" className="text-sm text-red-600">
          {weightFieldError}
        </p>
      )}
      {notice ? (
        <p role="status" className="text-sm text-slate-500">
          {notice}
        </p>
      ) : (
        existing && (
          <p className="text-sm text-amber-700">
            {formatCalendarDate(date)} already has {formatWeight(existing.weight)}. Recording again replaces it.
          </p>
        )
      )}
    </form>
  );
}
