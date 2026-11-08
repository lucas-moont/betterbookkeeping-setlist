import { useState, useTransition } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { todayIsoDate } from "@/lib/format";
import type { ProgressionMovement } from "@/lib/progression";
import { progressionMovementsQueryOptions } from "@/lib/progression/queries";
import { useTimeZone } from "@/lib/time-zone";
import { cn } from "@/lib/utils";
import { MovementCombobox, MovementList } from "./movement-picker";
import { defaultMovement, type Metric, type Period } from "./progression";
import { ProgressionChart, chartHeight } from "./progression-chart";

const metricOptions: SegmentedOption<Metric>[] = [
  { value: "maxWeight", label: "Max Weight" },
  { value: "totalReps", label: "Total Reps" },
  { value: "totalVolume", label: "Total Volume" },
];

const periodOptions: SegmentedOption<Period>[] = [
  { value: "3m", label: "3M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

/**
 * One Movement's Metric over time, above the Completed Workouts. The list holds only Movements with a
 * Completed Set in a Completed Workout; the card opens on the one with the most Training Days, on Max
 * Weight, over all time.
 */
export function ProgressionCard() {
  const { data } = useSuspenseQuery(progressionMovementsQueryOptions(useTimeZone()));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Progression</CardTitle>
      </CardHeader>
      <CardContent>
        {data.movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center" style={{ height: chartHeight }}>
            <p className="text-sm text-slate-500">No completed workouts yet.</p>
            <p className="text-sm text-slate-500">Complete a workout and your progress shows up here.</p>
          </div>
        ) : (
          <ProgressionPanel movements={data.movements} />
        )}
      </CardContent>
    </Card>
  );
}

function ProgressionPanel({ movements }: { movements: ProgressionMovement[] }) {
  const timeZone = useTimeZone();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("maxWeight");
  const [period, setPeriod] = useState<Period>("all");
  // A newly picked Movement loads its Training Days; the chart on screen stays until they arrive.
  const [loading, startTransition] = useTransition();

  // A picked Movement whose workouts were all deleted falls back to the default.
  const movement = movements.find((m) => m.id === pickedId) ?? defaultMovement(movements) ?? movements[0];
  const pick = (movementId: string) => startTransition(() => setPickedId(movementId));

  return (
    <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-2">
      <MovementList
        movements={movements}
        selectedId={movement.id}
        onPick={pick}
        className="hidden border-r border-slate-200 pr-4 lg:block"
      />
      <div className="min-w-0 space-y-3 lg:pl-4">
        <MovementCombobox movements={movements} selectedId={movement.id} onPick={pick} className="lg:hidden" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl label="Metric" options={metricOptions} value={metric} onChange={setMetric} dense />
          <SegmentedControl label="Period" options={periodOptions} value={period} onChange={setPeriod} />
        </div>
        <div className={cn("transition-opacity", loading && "opacity-60")}>
          <ProgressionChart
            movement={movement}
            metric={metric}
            metricLabel={metricOptions.find((option) => option.value === metric)?.label ?? ""}
            period={period}
            today={todayIsoDate(timeZone)}
            timeZone={timeZone}
            onShowAllTime={() => setPeriod("all")}
          />
        </div>
      </div>
    </div>
  );
}
