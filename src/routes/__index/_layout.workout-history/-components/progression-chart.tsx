import { useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { clipGaps } from "@/components/charts/chart-gaps";
import { formatAxisAmount, timeDomain } from "@/components/charts/time-axis";
import { TimeChart } from "@/components/charts/time-chart";
import { formatCalendarDate, formatCount, formatWeight } from "@/lib/format";
import type { ProgressionMovement } from "@/lib/progression";
import { progressionMetricsQueryOptions } from "@/lib/progression/queries";
import { chartGaps, metricPoints, periodStart, type Metric, type Period } from "./progression";

/** The chart and its empty states take the same height, so switching doesn't move the page. */
export const chartHeight = 300;

/** How each Metric reads: Loads in pounds, Total Reps as a bare count. */
const formatMetric: Record<Metric, (value: number) => string> = {
  maxWeight: formatWeight,
  totalReps: formatCount,
  totalVolume: formatWeight,
};

const periodWords: Record<Period, string> = { "3m": "the last 3 months", "1y": "the last year", all: "all time" };

/** "Latest: 205 lb on Nov 7, 2026", the chart over the period, and what it shows. */
export function ProgressionChart({
  movement,
  metric,
  metricLabel,
  period,
  today,
  timeZone,
  onShowAllTime,
}: {
  movement: ProgressionMovement;
  metric: Metric;
  metricLabel: string;
  period: Period;
  today: string;
  timeZone: string;
  onShowAllTime: () => void;
}) {
  const { data } = useSuspenseQuery(progressionMetricsQueryOptions(movement.id, timeZone));
  const from = periodStart(period, today);
  const points = metricPoints(data.days, metric, from);
  const lastDay = data.days.at(-1);

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height: chartHeight }}>
        <p className="text-sm text-slate-500">
          No Training Days for {movement.name} in {periodWords[period]}.
        </p>
        {lastDay && <p className="text-sm text-slate-500">Last one: {formatCalendarDate(lastDay.date)}.</p>}
        <button
          type="button"
          onClick={onShowAllTime}
          className="rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          Show all time
        </button>
      </div>
    );
  }

  const latest = points[points.length - 1];
  // Gaps come from every Training Day, then the chart clips them to the period on screen.
  const gaps = chartGaps(
    data.days.map((day) => day.date),
    today,
    movement.name,
  );
  const domain = timeDomain(from ?? points[0].date, today);
  const showsGap = clipGaps(gaps, domain).length > 0;
  const span = points.length === 1 ? "1 Training Day" : `${points.length} Training Days`;

  return (
    <div className="space-y-2">
      <p className="text-sm tabular-nums text-slate-500">
        Latest: <span className="font-medium text-slate-900">{formatMetric[metric](latest.value)}</span> on{" "}
        {formatCalendarDate(latest.date)}
      </p>
      <TimeChart
        points={points}
        today={today}
        from={from ?? undefined}
        gaps={gaps}
        formatValue={formatMetric[metric]}
        formatAxisValue={formatAxisAmount}
        ariaLabel={`${movement.name}, ${metricLabel}: ${span} from ${formatCalendarDate(points[0].date)} to ${formatCalendarDate(latest.date)}`}
        height={chartHeight}
      />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>
          One point per Training Day.
          {movement.isBodyWeight && " Load includes your body weight on the day of each set."}
        </span>
        {/* Today comes from the browser's clock, so whether a gap shows is decided there too. */}
        <ClientOnly fallback={null}>
          {showsGap && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm border border-slate-300 bg-slate-200/60" />
              More than 2 weeks without {movement.name}
            </span>
          )}
        </ClientOnly>
      </p>
    </div>
  );
}
