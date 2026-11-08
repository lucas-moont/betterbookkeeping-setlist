import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TimeChart } from "@/components/charts/time-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BodyWeightEntry } from "@/lib/body-weight";
import { bodyWeightEntriesQueryOptions } from "@/lib/body-weight/queries";
import { latestEntry } from "@/lib/body-weight/entry";
import { formatCalendarDate, formatWeight, formatWeightAmount, todayIsoDate } from "@/lib/format";
import { useTimeZone } from "@/lib/time-zone";
import { BodyWeightEntries } from "./-components/body-weight-entries";
import { BodyWeightForm } from "./-components/body-weight-form";

// The chart and its empty state take the same height, so the first entry doesn't move the page.
const chartHeight = 260;

export const Route = createFileRoute("/__index/_layout/profile/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(bodyWeightEntriesQueryOptions());
  },
  component: ProfilePage,
});

// The Profile has one section for now, Body Weight, so it has no sidebar of its own: one comes with a
// second section.
function ProfilePage() {
  const { data: entries } = useSuspenseQuery(bodyWeightEntriesQueryOptions());
  // The user's today, from the tz cookie on the server render and in the browser alike (ADR 0004).
  const today = todayIsoDate(useTimeZone());
  // The confirmation of the last record or delete, shown under the form.
  const [notice, setNotice] = useState<string | null>(null);
  const latest = latestEntry(entries);
  // Signed in for sure: the layout above redirects to sign-in otherwise.
  const { user } = Route.useRouteContext();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>

      <Card>
        <CardHeader className="flex-col gap-2 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle>Body Weight</CardTitle>
          {latest && (
            <p className="text-sm text-slate-500 tabular-nums">
              Latest: <span className="font-medium text-slate-900">{formatWeight(latest.weight)}</span> on{" "}
              {formatCalendarDate(latest.date)}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {latest ? (
            <TimeChart
              points={entries.map((entry) => ({ date: entry.date, value: entry.weight }))}
              today={today}
              formatValue={formatWeight}
              formatAxisValue={formatWeightAmount}
              ariaLabel={chartLabel(entries)}
              height={chartHeight}
            />
          ) : (
            <div
              className="flex flex-col items-center justify-center text-center text-sm text-slate-500"
              style={{ height: chartHeight }}>
              <p>No body weight recorded yet.</p>
              <p>Your first entry starts the chart.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BodyWeightForm entries={entries} today={today} notice={notice} onNotice={setNotice} />
          <BodyWeightEntries
            entries={entries}
            onDeleted={(date) => setNotice(`Deleted the entry for ${formatCalendarDate(date)}.`)}
          />
        </CardContent>
      </Card>

      {/* On a desktop the sidebar's user block says who is signed in; phones have no sidebar, so the
          Profile says it. */}
      <Card className="md:hidden">
        <CardContent className="pt-6 text-sm">
          <p className="text-xs text-slate-500">Logged in as</p>
          <p className="truncate font-medium text-slate-900">{user.name || user.email}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// What a screen reader hears for the Body Weight Chart: how many entries and over what dates.
// The entries come newest first, as list() returns them.
function chartLabel(entries: BodyWeightEntry[]): string {
  const newest = entries[0];
  const oldest = entries[entries.length - 1];
  const count = entries.length === 1 ? "1 entry" : `${entries.length} entries`;
  return `Body weight chart: ${count} from ${formatCalendarDate(oldest.date)} to ${formatCalendarDate(newest.date)}`;
}
