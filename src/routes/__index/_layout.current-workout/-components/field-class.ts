import { touchField } from "@/components/ui/touch";

/** The set form's number fields: the touch size, with digits that line up. */
export const fieldClass = `${touchField} tabular-nums`;

/**
 * Hides a number field's spin buttons: the fields are narrow, the arrows covered the placeholder, and
 * a phone shows a number pad instead.
 */
export const noSpinClass =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** A unit or count beside a field's value ("lb", "sets"), dim but still readable. */
export const affixClass = "pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-slate-500";
