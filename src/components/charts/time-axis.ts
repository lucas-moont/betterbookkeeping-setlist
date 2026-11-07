import { isoDateToUtc, utcToIsoDate } from "@/lib/iso-date";

// The axes of every time chart in the app (the Body Weight Chart now, the Progression Chart next), so
// both read time the same way. Pure: dates come in as "YYYY-MM-DD" and become UTC-midnight timestamps,
// which keeps every day exactly one day wide and no time zone can move a point (ADR 0004).

const dayMs = 24 * 60 * 60 * 1000;

/** The shortest stretch the X axis shows, so a single point doesn't sit alone at both edges. */
export const minAxisDays = 14;

/** A "YYYY-MM-DD" date as the timestamp of its UTC midnight. */
export function dateToTimestamp(isoDate: string): number {
  return isoDateToUtc(isoDate).getTime();
}

/** A timestamp from dateToTimestamp back to its "YYYY-MM-DD" date. */
export function timestampToDate(timestamp: number): string {
  return utcToIsoDate(new Date(timestamp));
}

/**
 * The X axis runs from the first point to today, so recent time without data shows as empty space on
 * the right, and it spans at least minAxisDays, ending today.
 */
export function timeDomain(firstDate: string, today: string): [number, number] {
  const end = dateToTimestamp(today);
  const start = Math.min(dateToTimestamp(firstDate), end - minAxisDays * dayMs);
  return [start, end];
}

/**
 * Ticks on the first day of each month inside the domain, thinned to at most maxTicks by keeping
 * every n-th month. A domain that crosses no month boundary gets its two ends instead, and `monthly`
 * says which, so the labels can read "Nov" or "Nov 2, 2026".
 */
export function monthTicks([start, end]: [number, number], maxTicks = 6): { ticks: number[]; monthly: boolean } {
  const months: number[] = [];
  const first = new Date(start);
  let year = first.getUTCFullYear();
  // A domain that starts on the 1st gets that month's tick at its left edge.
  let month = first.getUTCDate() === 1 ? first.getUTCMonth() : first.getUTCMonth() + 1;
  for (;;) {
    if (month === 12) {
      year += 1;
      month = 0;
    }
    const tick = Date.UTC(year, month, 1);
    if (tick > end) break;
    months.push(tick);
    month += 1;
  }
  if (months.length === 0) return { ticks: [start, end], monthly: false };
  const every = Math.ceil(months.length / maxTicks);
  return { ticks: months.filter((_, i) => i % every === 0), monthly: true };
}

/**
 * Whether a month tick names its year: the first tick does, and so does every tick in a different
 * year from the one before. Thinned ticks can skip January, so "the January tick" can't carry it.
 */
export function tickShowsYear(ticks: readonly number[], index: number): boolean {
  if (index === 0) return true;
  return new Date(ticks[index]).getUTCFullYear() !== new Date(ticks[index - 1]).getUTCFullYear();
}

/**
 * A Y range around the values with a round step: at least one unit of room above and below, widened to
 * a multiple of the step, so the line never touches the top or bottom edge.
 */
export function valueDomain(values: number[]): { domain: [number, number]; ticks: number[] } {
  const low = Math.floor(Math.min(...values) - 1);
  const high = Math.ceil(Math.max(...values) + 1);
  const span = high - low;
  const step = span <= 6 ? 1 : span <= 12 ? 2 : span <= 30 ? 5 : span <= 60 ? 10 : span <= 150 ? 25 : 50;
  const start = Math.floor(low / step) * step;
  const end = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let tick = start; tick <= end; tick += step) ticks.push(tick);
  return { domain: [start, end], ticks };
}
