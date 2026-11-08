import { useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCalendarDate, formatCalendarMonth } from "@/lib/format";
import { clipGaps, fittingLabel, splitAtGaps, type ChartGap } from "./chart-gaps";
import { monthTicks, tickShowsYear, timeDomain, timestampToDate, valueDomain } from "./time-axis";

// The app's one line chart over time (the Body Weight Chart now, the Progression Chart next), so both
// look and read the same. The X axis is numeric time, not categories: a month without data shows as a
// month of empty space, which keeps the trend honest (PRODUCT.md, "Show the trend, honestly").

/** One point: a calendar date and its value, and an optional last line for its tooltip. */
export type TimePoint = { date: string; value: number; note?: string };

export type { ChartGap };

type TimeChartProps = {
  /** At least one point, in any order. */
  points: TimePoint[];
  /** The user's today as "YYYY-MM-DD": the right end of the X axis. */
  today: string;
  /** The left end of the X axis, such as the start of a period; the first point when left out. */
  from?: string;
  /** Stretches without data to shade, with the line dashed across them. */
  gaps?: ChartGap[];
  /** How a value reads in the tooltip, with its unit, for example formatWeight. */
  formatValue: (value: number) => string;
  /** How a value reads on the Y axis, where the unit would repeat on every tick: formatWeightAmount. */
  formatAxisValue: (value: number) => string;
  /** A short description for screen readers, such as "Body weight chart: 24 entries from ... to ...". */
  ariaLabel: string;
  height?: number;
};

// DESIGN.md colors: Chalk Rust for the data, Hairline for the grid, Ink Muted for the labels, and a
// pale slate band for a gap.
const colors = {
  line: "var(--color-primary)",
  grid: "#e2e8f0",
  axis: "#cbd5e1",
  label: "#64748b",
  cursor: "#94a3b8",
  gap: "#e2e8f0",
  gapLabel: "#475569",
};

/** How close to a point, in pixels, the pointer must be for the point's tooltip to win over a gap's. */
const pointPriorityPx = 12;

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
  from,
  gaps = [],
  formatValue,
  formatAxisValue,
  height,
}: Omit<TimeChartProps, "ariaLabel"> & { height: number }) {
  // Which gap the pointer is over, where the pointer is, and where the nearest point is, in pixels.
  const [hoveredGap, setHoveredGap] = useState<ChartGap | null>(null);
  const [pointerX, setPointerX] = useState<number | null>(null);
  const [pointX, setPointX] = useState<number | null>(null);

  const firstDate = points.reduce((first, point) => (point.date < first ? point.date : first), points[0].date);
  const xDomain = timeDomain(from ?? firstDate, today);
  const x = monthTicks(xDomain);
  const y = valueDomain(points.map((point) => point.value));
  const bands = clipGaps(gaps, xDomain);
  const { rows, bridges } = splitAtGaps(points, bands.map((band) => band.gap));
  // A point's tooltip wins near the point; elsewhere in a band, the gap's.
  const gapActive =
    hoveredGap !== null && (pointX === null || pointerX === null || Math.abs(pointerX - pointX) > pointPriorityPx);

  return (
    <div
      className="h-full w-full"
      onPointerMove={(event) => setPointerX(event.clientX - event.currentTarget.getBoundingClientRect().left)}
      onPointerLeave={() => {
        setPointerX(null);
        setHoveredGap(null);
      }}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={rows}
          margin={{ top: 12, right: 16, bottom: 4, left: 0 }}
          onMouseMove={(state) => {
            const row = rows[Number(state.activeTooltipIndex)];
            // The break in the middle of a gap is a row with no value: no point to show there.
            setPointX(row && row.value !== null ? (state.activeCoordinate?.x ?? null) : null);
          }}
          onMouseLeave={() => setPointX(null)}>
          {bands.map(({ gap, x1, x2 }) => (
            <ReferenceArea
              key={gap.from}
              x1={x1}
              x2={x2}
              // Clipped to the plot, so a band that began before the window still shows its part.
              ifOverflow="hidden"
              fill={colors.gap}
              fillOpacity={0.6}
              stroke="none"
              onMouseEnter={() => setHoveredGap(gap)}
              onMouseLeave={() => setHoveredGap(null)}
              onClick={() => setHoveredGap(gap)}
              label={(props: { viewBox?: { x?: number; y?: number; width?: number } }) => (
                <GapLabel viewBox={props.viewBox} labels={[gap.title, gap.duration]} />
              )}
            />
          ))}
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
            cursor={gapActive ? false : { stroke: colors.cursor, strokeDasharray: "3 3" }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (gapActive && hoveredGap) {
                return (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm tabular-nums">
                    <p className="font-medium text-slate-900">{hoveredGap.title}</p>
                    <p className="text-slate-500">{hoveredGap.detail}</p>
                  </div>
                );
              }
              const point = active ? (payload?.[0]?.payload as Partial<TimePoint> | undefined) : undefined;
              if (!point || point.value == null || !point.date) return null;
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm tabular-nums">
                  <p className="font-medium text-slate-900">{formatValue(point.value)}</p>
                  <p className="text-slate-500">{formatCalendarDate(point.date, "medium")}</p>
                  {point.note && <p className="text-slate-500">{point.note}</p>}
                </div>
              );
            }}
          />
          {/* Each closed gap's two points, joined by a fainter dashed segment, kept out of the tooltip. */}
          {bridges.map(([left, right]) => (
            <Line
              key={left.t}
              data={[left, right]}
              dataKey="value"
              type="linear"
              stroke={colors.line}
              strokeOpacity={0.55}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
              tooltipType="none"
              legendType="none"
              isAnimationActive={false}
            />
          ))}
          <Line
            dataKey="value"
            type="linear"
            stroke={colors.line}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={{ r: 3, fill: "#ffffff", stroke: colors.line, strokeWidth: 2 }}
            activeDot={gapActive ? false : { r: 5, fill: colors.line, stroke: "#ffffff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A gap band's label at its top: the full title if it fits, else the duration, else nothing. */
function GapLabel({ viewBox, labels }: { viewBox?: { x?: number; y?: number; width?: number }; labels: string[] }) {
  const width = viewBox?.width ?? 0;
  const label = fittingLabel(width, labels);
  if (!label) return null;
  return (
    <text
      x={(viewBox?.x ?? 0) + width / 2}
      y={(viewBox?.y ?? 0) + 16}
      textAnchor="middle"
      fontSize={11}
      fill={colors.gapLabel}>
      {label}
    </text>
  );
}
