import { z } from "zod";

// Pure and free of server code, so the workouts module, and later the Progression Charts and the
// screens, can all import the same formula and the same rule for a valid Weight.

/** The largest Weight a numeric(6,2) column holds, and the smallest step between two Weights (ADR 0002). */
export const maxWeight = 9999.99;
export const weightStep = 0.01;

/**
 * Any weight as a form sends it: pounds with at most two decimals, up to maxWeight either way. The
 * column would round extra decimals, so a value that rounding to two decimals would change is refused
 * instead. Each caller adds its own minimum: 0 for a Set's Weight, while Added Weight can be negative.
 */
export const weightSchema = z
  .number()
  .min(-maxWeight, `Enter a weight of at least -${maxWeight}`)
  .max(maxWeight, `Enter a weight up to ${maxWeight}`)
  .refine((weight) => roundToHundredths(weight) === weight, "Use at most two decimals");

function roundToHundredths(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The total weight moved in one rep of a Set: `weight + (addedWeight ?? 0)`, rounded to two decimals
 * (CONTEXT.md, ADR 0003). This is the only place that formula lives. Weights have at most two
 * decimals (ADR 0002), so the sum times 100 is an integer give or take float error, and rounding
 * gives back exactly what Postgres numeric would.
 */
export function load(set: { weight: number; addedWeight?: number | null }): number {
  return roundToHundredths(set.weight + (set.addedWeight ?? 0));
}
