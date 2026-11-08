import { useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly, useHydrated } from "@tanstack/react-router";
import { visibleGaps } from "@/components/charts/chart-gaps";
import { formatAxisAmount } from "@/components/charts/time-axis";
import { TimeChart } from "@/components/charts/time-chart";
import { Button } from "@/components/ui/button";
import { formatCalendarDate, todayIsoDate } from "@/lib/format";
import type { ProgressionMovement } from "@/lib/progression";
import { progressionMetricsQueryOptions } from "@/lib/progression/queries";
import { useTimeZone } from "@/lib/time-zone";
import { chartGaps, metricPoints, metrics, periodStart, periods, type Metric, type Period } from "./progression";

/** The chart and its empty states take the same height, so switching doesn't move the page. */
export const chartHeight = 300;

/** "Latest: 205 lb on Nov 7, 2026", the chart over the period, and what it shows. */
export function ProgressionChart({
  movement,
  metric,
  period,
  onShowAllTime,
}: {
  movement: ProgressionMovement;
  metric: Metric;
  period: Period;
  onShowAllTime: () => void;
}) {
  const timeZone = useTimeZone();
  const hydrated = useHydrated();
  // The user's today, from the tz cookie on the server render and in the browser alike (ADR 0004).
  const today = todayIsoDate(timeZone);
  const { data } = useSuspenseQuery(progressionMetricsQueryOptions(movement.id, timeZone));
  const from = periodStart(period, today);
  const points = metricPoints(data.days, metric, from);
  const { label, format } = metrics[metric];
  const lastDay = data.days.at(-1);

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height: chartHeight }}>
        <p className="text-sm text-slate-500">
          No Training Days for {movement.name} in {periods[period].words}.
        </p>
        {lastDay && <p className="text-sm text-slate-500">Last one: {formatCalendarDate(lastDay.date)}.</p>}
        <Button variant="link" onClick={onShowAllTime} className="h-11 shrink-0 px-2 text-sm sm:h-auto">
          Show all time
        </Button>
      </div>
    );
  }

  const latest = points[points.length - 1];
  // Gaps come from every Training Day; the chart and this legend show the ones on its axis.
  const gaps = chartGaps(
    data.days.map((day) => day.date),
    today,
    movement.name,
  );
  const shownGaps = visibleGaps(points, today, from, gaps);
  const openGap = shownGaps.find((band) => band.gap.open)?.gap;
  const span = points.length === 1 ? "1 Training Day" : `${points.length} Training Days`;
  // A screen reader hears what the shading shows: ", No Bench Press since Jun 3, 2026, 5 months so far".
  // Only once hydrated: today is the browser's, and React keeps a server attribute that differs.
  const openGapWords = hydrated && openGap ? `, ${openGap.title}, ${openGap.detail}` : "";

  return (
    <div className="space-y-2">
      <p className="text-sm tabular-nums text-slate-500">
        Latest: <span className="font-medium text-slate-900">{format(latest.value)}</span> on{" "}
        {formatCalendarDate(latest.date)}
      </p>
      <TimeChart
        points={points}
        today={today}
        from={from}
        gaps={gaps}
        formatValue={format}
        formatAxisValue={formatAxisAmount}
        ariaLabel={`${movement.name}, ${label}: ${span} from ${formatCalendarDate(points[0].date)} to ${formatCalendarDate(latest.date)}${openGapWords}`}
        height={chartHeight}
      />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>
          One point per Training Day.
          {movement.isBodyWeight && " Load includes your body weight on the day of each set."}
        </span>
        {/* Today comes from the browser's clock, so whether a gap shows is decided there too. */}
        <ClientOnly fallback={null}>
          {shownGaps.length > 0 && (
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
