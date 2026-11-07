import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { bodyWeightEntriesQueryOptions } from "@/lib/body-weight/queries";
import { formatCalendarDate, todayIsoDate } from "@/lib/format";
import { useTimeZone } from "@/lib/time-zone";
import { BodyWeightEntries } from "./-components/body-weight-entries";
import { BodyWeightForm } from "./-components/body-weight-form";

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>

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
    </div>
  );
}
