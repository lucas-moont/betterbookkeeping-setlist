import { useId, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProgressionMovement } from "@/lib/progression";
import { cn } from "@/lib/utils";
import { matchMovements } from "./progression";

// Two ways to pick the charted Movement, the same rules in both: typing filters the list already
// loaded, ignoring case; Enter picks the first match; Esc clears. Filtering never changes the chart,
// only picking does.

type PickerProps = {
  movements: ProgressionMovement[];
  selectedId: string;
  onPick: (movementId: string) => void;
};

const searchClass = "h-11 pl-9 text-base sm:h-10 sm:text-sm [&::-webkit-search-cancel-button]:cursor-pointer";

function SearchIcon() {
  return (
    <Search
      aria-hidden="true"
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
    />
  );
}

function NoMatch({ query, className }: { query: string; className?: string }) {
  return <p className={cn("px-3 py-2 text-sm text-slate-500", className)}>No movements match "{query.trim()}".</p>;
}

/** From lg up: a search field over the whole list, each Movement with its number of Training Days. */
export function MovementList({ movements, selectedId, onPick, className }: PickerProps & { className?: string }) {
  const [query, setQuery] = useState("");
  const shown = matchMovements(movements, query);

  return (
    <div className={className}>
      <div className="relative mb-3">
        <SearchIcon />
        <Input
          type="search"
          aria-label="Search movements"
          placeholder="Search movements"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && shown[0]) {
              e.preventDefault();
              onPick(shown[0].id);
            }
            if (e.key === "Escape") setQuery("");
          }}
          className={searchClass}
        />
      </div>
      <p aria-hidden="true" className="flex justify-between px-3 pb-2 text-xs font-medium text-slate-500">
        <span>Movement</span>
        <span>Training Days</span>
      </p>
      {shown.length === 0 ? (
        <NoMatch query={query} />
      ) : (
        <ul aria-label="Movements" className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {shown.map((movement) => {
            const selected = movement.id === selectedId;
            return (
              <li key={movement.id}>
                <button
                  type="button"
                  aria-current={selected}
                  onClick={() => onPick(movement.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    selected
                      ? "bg-slate-100 font-medium text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}>
                  <span className="truncate">{movement.name}</span>{" "}
                  <span className="text-xs tabular-nums text-slate-500">{movement.trainingDays}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Below lg: a combobox. The field shows the charted Movement; focusing it opens the whole list, and
 * typing filters it.
 */
export function MovementCombobox({ movements, selectedId, onPick, className }: PickerProps & { className?: string }) {
  const inputId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const shown = matchMovements(movements, query);
  const selectedName = movements.find((movement) => movement.id === selectedId)?.name ?? "";

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const pick = (movementId: string) => {
    onPick(movementId);
    close();
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        Movement
      </label>
      <div className="relative">
        <SearchIcon />
        <Input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Search movements"
          value={open ? query : selectedName}
          onFocus={() => setOpen(true)}
          onBlur={close}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && open && shown[0]) {
              e.preventDefault();
              pick(shown[0].id);
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              // A search field clears itself on Escape, which would reopen the list empty.
              e.preventDefault();
              close();
              e.currentTarget.blur();
            }
          }}
          className={searchClass}
        />
        {open &&
          (shown.length === 0 ? (
            <NoMatch
              query={query}
              className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-sm"
            />
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label="Movements"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              {shown.map((movement) => {
                const selected = movement.id === selectedId;
                return (
                  <li
                    key={movement.id}
                    role="option"
                    aria-selected={selected}
                    // Before the field's blur closes the list.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(movement.id)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-base sm:min-h-9 sm:text-sm",
                      selected ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-100",
                    )}>
                    <span className="truncate">{movement.name}</span>
                    <span className="text-xs tabular-nums text-slate-500">{movement.trainingDays}</span>
                  </li>
                );
              })}
            </ul>
          ))}
      </div>
    </div>
  );
}
