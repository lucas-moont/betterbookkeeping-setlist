import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BodyWeightEntry } from "@/lib/body-weight";
import { deleteBodyWeightEntryMutationOptions } from "@/lib/body-weight/queries";
import { formatCalendarDate, formatWeight } from "@/lib/format";

/** How many entries show before "Show all": about two months of one entry a week. */
const collapsedCount = 8;

type BodyWeightEntriesProps = {
  /** Newest date first, as the module lists them. */
  entries: BodyWeightEntry[];
  onDeleted: (date: string) => void;
};

/** The user's Body Weight Entries as rows, newest first, each with its delete button. */
export function BodyWeightEntries({ entries, onDeleted }: BodyWeightEntriesProps) {
  const [showAll, setShowAll] = useState(false);

  if (entries.length === 0) return <p className="text-sm text-slate-500">No entries yet.</p>;

  const shown = showAll ? entries : entries.slice(0, collapsedCount);
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {shown.map((entry) => (
          <EntryRow key={entry.date} entry={entry} onDeleted={onDeleted} />
        ))}
      </ul>
      {entries.length > collapsedCount && (
        <Button variant="link" size="sm" className="px-0" onClick={() => setShowAll((all) => !all)}>
          {showAll ? "Show fewer" : `Show all ${entries.length} entries`}
        </Button>
      )}
    </div>
  );
}

// Each row owns its delete, so a row stays disabled until its own delete finishes, even when the
// user deletes another row meanwhile.
function EntryRow({ entry, onDeleted }: { entry: BodyWeightEntry; onDeleted: (date: string) => void }) {
  const deleteMutation = useMutation({
    ...deleteBodyWeightEntryMutationOptions(),
    onSuccess: () => onDeleted(entry.date),
  });

  return (
    <li className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm tabular-nums">
      <div>
        <span className="font-medium text-slate-900">{formatWeight(entry.weight)}</span>
        <span className="ml-2 text-slate-500">{formatCalendarDate(entry.date, "medium")}</span>
      </div>
      <Button
        aria-label={`Delete entry for ${formatCalendarDate(entry.date)}`}
        variant="ghost"
        size="icon"
        disabled={deleteMutation.isPending}
        onClick={() => deleteMutation.mutate(entry.date)}
        className="h-8 w-8 text-slate-400">
        <X className="w-4 h-4" />
      </Button>
    </li>
  );
}
