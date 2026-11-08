import { isoDateToUtc } from "@/lib/iso-date";

// Gaps in training on a Progression Chart (CONTEXT.md). Pure and free of server code, so the chart computes them
// in the browser from the Training Days it already has. Dates are "YYYY-MM-DD" text (ADR 0004), and
// day math goes through UTC midnights, so no time zone or daylight-saving change can move a day.

/** A stretch with no Training Day: from the last one before it to the next one, or to today. */
export type Gap = { from: string; to: string; days: number; open: boolean };

/** The shortest Gap: training once a week and missing one session leaves 14 days, never a Gap. */
export const minGapDays = 15;

const dayMs = 24 * 60 * 60 * 1000;

function daysBetween(from: string, to: string): number {
  return Math.round((isoDateToUtc(to).getTime() - isoDateToUtc(from).getTime()) / dayMs);
}

/**
 * The Gaps of at least `minDays` calendar days between Training Days, oldest first. A Gap that
 * still goes on runs to `today` and is open. The dates can come in any order, with repeats.
 */
export function findGaps(dates: readonly string[], today: string, minDays = minGapDays): Gap[] {
  // "YYYY-MM-DD" text sorts the way the dates do.
  const days = [...new Set(dates)].sort();
  const gaps: Gap[] = [];
  days.forEach((from, i) => {
    const next = days[i + 1];
    const to = next ?? today;
    const length = daysBetween(from, to);
    if (length >= minDays) gaps.push({ from, to, days: length, open: next === undefined });
  });
  return gaps;
}

/** How long a Gap was, in words: whole weeks under 60 days, whole 30-day months from there. */
export function gapDurationLabel(days: number): string {
  const [count, unit] = days < 60 ? [Math.floor(days / 7), "week"] : [Math.floor(days / 30), "month"];
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}
