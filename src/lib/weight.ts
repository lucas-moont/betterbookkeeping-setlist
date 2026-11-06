// Pure and free of server code, so the workouts module, and later the Progression Charts and the
// screens, can all import the same formula.

/**
 * The total weight moved in one rep of a Set: `weight + (addedWeight ?? 0)`, rounded to two decimals
 * (CONTEXT.md, ADR 0003). This is the only place that formula lives. Weights have at most two
 * decimals (ADR 0002), so the sum times 100 is an integer give or take float error, and rounding
 * gives back exactly what Postgres numeric would.
 */
export function load(set: { weight: number; addedWeight?: number | null }): number {
  return Math.round((set.weight + (set.addedWeight ?? 0)) * 100) / 100;
}
