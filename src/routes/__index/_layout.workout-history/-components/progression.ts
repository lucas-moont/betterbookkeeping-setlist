import type { ChartGap, TimePoint } from "@/components/charts/time-chart";
import { formatCalendarDate } from "@/lib/format";
import { isoDateToUtc, utcToIsoDate } from "@/lib/iso-date";
import type { ProgressionMovement, TrainingDayMetrics } from "@/lib/progression";
import { findGaps, gapDurationLabel } from "@/lib/progression/gaps";

// The Progression card's rules, pure so they are tested without a browser: which Movement it opens
// on, how the search matches, what a period covers, and the words on the chart's gaps.

/** The three Metrics of a Training Day (CONTEXT.md). */
export type Metric = "maxWeight" | "totalReps" | "totalVolume";

export type Period = "3m" | "1y" | "all";

/** How far back each period reaches, in days. All has no start. */
const periodDays: Record<Period, number | null> = { "3m": 91, "1y": 365, all: null };

/** The Movement the card opens on: the one with the most Training Days, the first by name on a tie. */
export function defaultMovement(movements: ProgressionMovement[]): ProgressionMovement | undefined {
  return [...movements]
    .sort((a, b) => b.trainingDays - a.trainingDays || a.name.localeCompare(b.name))
    .at(0);
}

/** The Movements whose name holds the text, ignoring case. Front end only: the list is already here. */
export function matchMovements(movements: ProgressionMovement[], query: string): ProgressionMovement[] {
  const text = query.trim().toLowerCase();
  return text ? movements.filter((movement) => movement.name.toLowerCase().includes(text)) : movements;
}

/** The first calendar date a period shows, or null for All. */
export function periodStart(period: Period, today: string): string | null {
  const days = periodDays[period];
  if (days === null) return null;
  const start = isoDateToUtc(today);
  start.setUTCDate(start.getUTCDate() - days);
  return utcToIsoDate(start);
}

/** One chart point per Training Day from `from` on, with a note when it combines several workouts. */
export function metricPoints(days: TrainingDayMetrics[], metric: Metric, from: string | null): TimePoint[] {
  return days
    .filter((day) => from === null || day.date >= from)
    .map((day) => ({
      date: day.date,
      value: day[metric],
      ...(day.workouts > 1 ? { note: `${day.workouts} workouts combined` } : {}),
    }));
}

/**
 * The breaks in a Movement's training, found over all its Training Days and worded for the chart:
 * "3 weeks without Bench Press" from Mar 11, 2026 to Apr 1, 2026, or, still going on, "No Overhead
 * Press since Jun 3, 2026", 5 months so far. The chart clips them to the period on screen.
 */
export function chartGaps(dates: string[], today: string, movementName: string): ChartGap[] {
  return findGaps(dates, today).map((gap) => {
    const duration = gapDurationLabel(gap.days);
    return {
      from: gap.from,
      to: gap.to,
      open: gap.open,
      title: gap.open
        ? `No ${movementName} since ${formatCalendarDate(gap.from)}`
        : `${duration} without ${movementName}`,
      duration,
      detail: gap.open ? `${duration} so far` : `${formatCalendarDate(gap.from)} to ${formatCalendarDate(gap.to)}`,
    };
  });
}
