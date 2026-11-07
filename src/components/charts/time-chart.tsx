import { ClientOnly } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCalendarDate, formatCalendarMonth } from "@/lib/format";
import { dateToTimestamp, monthTicks, tickShowsYear, timeDomain, timestampToDate, valueDomain } from "./time-axis";

// The app's one line chart over time (the Body Weight Chart now, the Progression Chart next), so both
// look and read the same. The X axis is numeric time, not categories: a month without data shows as a
// month of empty space, which keeps the trend honest (PRODUCT.md, "Show the trend, honestly").

/** One point: a calendar date and its value. */
export type TimePoint = { date: string; value: number };

type TimeChartProps = {
  /** At least one point, in any order. */
  points: TimePoint[];
  /** The user's today as "YYYY-MM-DD": the right end of the X axis. */
  today: string;
  /** How a value reads in the tooltip, with its unit, for example formatWeight. */
  formatValue: (value: number) => string;
  /** How a value reads on the Y axis, where the unit would repeat on every tick: formatWeightAmount. */
  formatAxisValue: (value: number) => string;
  /** A short description for screen readers, such as "Body weight chart: 24 entries from ... to ...". */
  ariaLabel: string;
  height?: number;
};

// DESIGN.md colors: Chalk Rust for the data, Hairline for the grid, Ink Muted for the labels.
const colors = {
  line: "var(--color-primary)",
  grid: "#e2e8f0",
  axis: "#cbd5e1",
  label: "#64748b",
  cursor: "#94a3b8",
};

const tickStyle = { fontSize: 12, fill: colors.label };

/**
 * Recharts measures the DOM, so the chart renders in the browser only. The server sends a box of the
 * same height, so nothing below it moves when the chart appears.
 */
export function TimeChart({ height = 260, ...props }: TimeChartProps) {
  return (
    <div role="img" aria-label={props.ariaLabel} className="w-full tabular-nums" style={{ height }}>
      <ClientOnly fallback={null}>
        <TimeChartBody {...props} height={height} />
      </ClientOnly>
    </div>
  );
}

function TimeChartBody({
  points,
  today,
  formatValue,
  formatAxisValue,
  height,
}: Omit<TimeChartProps, "ariaLabel"> & { height: number }) {
  const data = [...points]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((point) => ({ ...point, t: dateToTimestamp(point.date) }));
  const xDomain = timeDomain(data[0].date, today);
  const x = monthTicks(xDomain);
  const y = valueDomain(data.map((point) => point.value));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={xDomain}
          ticks={x.ticks}
          // Month ticks read "Nov", with the year on the first one and where it changes; the two ends of
          // a short domain read "Nov 2, 2026".
          // Our own ticks, already thinned, so recharts must not drop any (which would shift the year).
          interval={0}
          tickFormatter={(t: number) =>
            x.monthly
              ? formatCalendarMonth(timestampToDate(t), { withYear: tickShowsYear(x.ticks, x.ticks.indexOf(t)) })
              : formatCalendarDate(timestampToDate(t))
          }
          tick={tickStyle}
          tickLine={{ stroke: colors.axis }}
          axisLine={{ stroke: colors.axis }}
        />
        <YAxis
          type="number"
          domain={y.domain}
          ticks={y.ticks}
          tickFormatter={formatAxisValue}
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ stroke: colors.cursor, strokeDasharray: "3 3" }}
          isAnimationActive={false}
          content={({ active, payload }) => {
            const point = active ? (payload?.[0]?.payload as TimePoint | undefined) : undefined;
            if (!point) return null;
            return (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm tabular-nums">
                <p className="font-medium text-slate-900">{formatValue(point.value)}</p>
                <p className="text-slate-500">{formatCalendarDate(point.date, "medium")}</p>
              </div>
            );
          }}
        />
        <Line
          dataKey="value"
          type="linear"
          stroke={colors.line}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          dot={{ r: 3, fill: "#ffffff", stroke: colors.line, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: colors.line, stroke: "#ffffff", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
