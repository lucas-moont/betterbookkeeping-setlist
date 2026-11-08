import { dateToTimestamp, timeDomain } from "./time-axis";

// Gaps on a time chart: shaded bands where the data stops for a while, with the line dashed across
// them. Pure, so the drawing in time-chart.tsx stays thin. The screen finds the gaps and writes their
// words (src/lib/progression/gaps.ts); the chart only places them.

/** A gap as the chart draws it, with its words already written by the screen. */
export type ChartGap = {
  from: string;
  to: string;
  /** Still going on: it runs to today and has no point on its right. */
  open: boolean;
  /** The band's label and the tooltip's first line: "3 weeks without Bench Press". */
  title: string;
  /** The band's label when the title doesn't fit: "3 weeks". */
  duration: string;
  /** The tooltip's second line: "Mar 11, 2026 to Apr 1, 2026" or "5 months so far". */
  detail: string;
};

export type GapBand = { gap: ChartGap; x1: number; x2: number };

/**
 * The gaps that show in the X domain, clipped to it: a gap that began before the window starts at the
 * window's left edge. Numeric timestamps, which ReferenceArea needs (a Date counts as absent).
 */
export function clipGaps(gaps: ChartGap[], [start, end]: [number, number]): GapBand[] {
  return gaps.flatMap((gap) => {
    const x1 = Math.max(dateToTimestamp(gap.from), start);
    const x2 = Math.min(dateToTimestamp(gap.to), end);
    return x2 > x1 ? [{ gap, x1, x2 }] : [];
  });
}

/**
 * The X axis of a chart of these points: from `from` (a period's start) or the first point, to today.
 * time-chart.tsx draws this axis, so a legend that asks whether a gap shows sees the same one.
 */
export function chartDomain(points: { date: string }[], today: string, from?: string): [number, number] {
  const first = points.reduce((earliest, point) => (point.date < earliest ? point.date : earliest), points[0].date);
  return timeDomain(from ?? first, today);
}

/** The gaps that show on a chart of these points, clipped to its X axis. */
export function visibleGaps(
  points: { date: string }[],
  today: string,
  from: string | undefined,
  gaps: ChartGap[],
): GapBand[] {
  return clipGaps(gaps, chartDomain(points, today, from));
}

/** About how wide a character of the 11px band label is, and the room kept around it. */
const charWidth = 6.2;
const labelPadding = 12;

/** The first label that fits a band this many pixels wide, or nothing; the tooltip still says it all. */
export function fittingLabel(width: number, labels: string[]): string | undefined {
  return labels.find((label) => width >= label.length * charWidth + labelPadding);
}

type Point = { t: number; value: number };

/**
 * The line's rows, broken in the middle of each closed gap, and the dashed bridges that join the two
 * points around each break. A gap whose left point is outside the data (before the window) or that is
 * still open has nothing to bridge.
 */
export function splitAtGaps<P extends { date: string; value: number }>(
  points: P[],
  gaps: ChartGap[],
): { rows: ((P & { t: number }) | { t: number; value: null })[]; bridges: [Point, Point][] } {
  const rows: ((P & { t: number }) | { t: number; value: null })[] = [...points]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((point) => ({ ...point, t: dateToTimestamp(point.date) }));
  const byDate = new Map(points.map((point) => [point.date, { t: dateToTimestamp(point.date), value: point.value }]));
  const bridges: [Point, Point][] = [];
  for (const gap of gaps) {
    const left = byDate.get(gap.from);
    const right = byDate.get(gap.to);
    if (gap.open || !left || !right) continue;
    rows.push({ t: (left.t + right.t) / 2, value: null });
    bridges.push([left, right]);
  }
  rows.sort((a, b) => a.t - b.t);
  return { rows, bridges };
}
