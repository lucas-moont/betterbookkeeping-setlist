/** The set form's field size: 44px tall on a phone, like the Movements form. */
export const fieldClass = "h-11 text-base tabular-nums sm:h-10 sm:text-sm";

/**
 * Hides a number field's spin buttons: the fields are narrow, the arrows covered the placeholder, and
 * a phone shows a number pad instead.
 */
export const noSpinClass =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/** A unit or count beside a field's value ("lb", "sets"), dim but still readable. */
export const affixClass = "pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-slate-500";
