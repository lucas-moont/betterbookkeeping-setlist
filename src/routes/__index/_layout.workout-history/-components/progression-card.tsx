import { useDeferredValue, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import type { ProgressionMovement } from "@/lib/progression";
import { progressionMovementsQueryOptions } from "@/lib/progression/queries";
import { useTimeZone } from "@/lib/time-zone";
import { cn } from "@/lib/utils";
import { MovementCombobox, MovementList } from "./movement-picker";
import { defaultMovement, metrics, periods, type Metric, type Period } from "./progression";
import { ProgressionChart, chartHeight } from "./progression-chart";

/** A segmented control's options from a record of choices, each with its label. */
function toOptions<T extends string>(record: Record<T, { label: string }>): SegmentedOption<T>[] {
  return (Object.keys(record) as T[]).map((value) => ({ value, label: record[value].label }));
}

const metricOptions = toOptions<Metric>(metrics);
const periodOptions = toOptions<Period>(periods);

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
          // Completed Workouts can exist with no Completed Set in them, so this speaks of Training Days.
          <div className="flex flex-col items-center justify-center text-center" style={{ height: chartHeight }}>
            <p className="text-sm text-slate-500">No Training Days yet.</p>
            <p className="text-sm text-slate-500">Complete a set in a workout and your progress shows up here.</p>
          </div>
        ) : (
          <ProgressionPanel movements={data.movements} />
        )}
      </CardContent>
    </Card>
  );
}

function ProgressionPanel({ movements }: { movements: ProgressionMovement[] }) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("maxWeight");
  const [period, setPeriod] = useState<Period>("all");

  // A picked Movement whose workouts were all deleted falls back to the default.
  // The list is never empty here, so there is always a default.
  const movement = (movements.find((m) => m.id === pickedId) ?? defaultMovement(movements)) as ProgressionMovement;
  // The pick shows at once in the list and the combobox; the chart keeps the previous Movement, dimmed,
  // until the new one's Training Days have loaded.
  const chartedMovement = useDeferredValue(movement);
  const loading = chartedMovement.id !== movement.id;

  return (
    <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-2">
      <MovementList
        movements={movements}
        selectedId={movement.id}
        onPick={setPickedId}
        className="hidden border-r border-slate-200 pr-4 lg:block"
      />
      <div className="min-w-0 space-y-3 lg:pl-4">
        <MovementCombobox movements={movements} selectedId={movement.id} onPick={setPickedId} className="lg:hidden" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl label="Metric" options={metricOptions} value={metric} onChange={setMetric} dense />
          <SegmentedControl label="Period" options={periodOptions} value={period} onChange={setPeriod} />
        </div>
        <div className={cn("transition-opacity", loading && "opacity-60")}>
          <ProgressionChart
            movement={chartedMovement}
            metric={metric}
            period={period}
            onShowAllTime={() => setPeriod("all")}
          />
        </div>
      </div>
    </div>
  );
}
