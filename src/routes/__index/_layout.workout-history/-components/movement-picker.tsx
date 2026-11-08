import { useId, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProgressionMovement } from "@/lib/progression";
import { cn } from "@/lib/utils";
import { matchMovements } from "./progression";

// Two ways to pick the charted Movement, the same rules in both: typing filters the list already
// loaded, ignoring case; Enter picks; Esc clears. Filtering never changes the chart, only picking does.

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

/** The search found nothing; a status, so a screen reader says so as the user types. */
function NoMatch({ query, className }: { query: string; className?: string }) {
  return (
    <p role="status" className={cn("px-3 py-2 text-sm text-slate-500", className)}>
      No movements match "{query.trim()}".
    </p>
  );
}

/** A Movement's number of Training Days; the words are for screen readers, the column header shows them. */
function TrainingDays({ count }: { count: number }) {
  return (
    <span className="text-xs tabular-nums text-slate-500">
      {count}
      <span className="sr-only"> Training Days</span>
    </span>
  );
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
                  <TrainingDays count={movement.trainingDays} />
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
 * Below lg: a combobox. The field shows the charted Movement. A tap, typing or ArrowDown opens the
 * list; the arrows move through it, Enter picks the option they rest on (the first match when none),
 * and Esc closes it keeping the Movement. Focus stays in the field throughout.
 */
export function MovementCombobox({ movements, selectedId, onPick, className }: PickerProps & { className?: string }) {
  const inputId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // The option the arrows rest on, or -1 when they haven't moved since the list opened or changed.
  const [activeIndex, setActiveIndex] = useState(-1);
  const shown = matchMovements(movements, query);
  const selectedName = movements.find((movement) => movement.id === selectedId)?.name ?? "";
  const listShown = open && shown.length > 0;
  const optionId = (movementId: string) => `${listId}-${movementId}`;
  const active = listShown ? shown[activeIndex] : undefined;

  const openList = () => {
    setOpen(true);
    setActiveIndex(-1);
  };
  const close = () => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
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
          aria-expanded={listShown}
          aria-controls={listShown ? listId : undefined}
          aria-activedescendant={active ? optionId(active.id) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Search movements"
          value={open ? query : selectedName}
          onClick={() => {
            if (!open) openList();
          }}
          onBlur={close}
          onChange={(e) => {
            openList();
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) openList();
              setActiveIndex((index) => Math.min(index + 1, shown.length - 1));
            }
            if (e.key === "ArrowUp" && open) {
              e.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            }
            if (e.key === "Enter" && open) {
              e.preventDefault();
              const choice = active ?? shown[0];
              if (choice) pick(choice.id);
            }
            if (e.key === "Escape") {
              // A search field clears itself on Escape; here Esc only closes the list.
              e.preventDefault();
              close();
            }
          }}
          className={searchClass}
        />
        {open && shown.length === 0 && (
          <NoMatch
            query={query}
            className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-sm"
          />
        )}
        {listShown && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Movements"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {shown.map((movement, index) => {
              const selected = movement.id === selectedId;
              return (
                <li
                  key={movement.id}
                  id={optionId(movement.id)}
                  role="option"
                  aria-selected={selected}
                  // Before the field's blur closes the list.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(movement.id)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-base sm:min-h-9 sm:text-sm",
                    selected ? "font-medium text-slate-900" : "text-slate-600",
                    index === activeIndex || selected ? "bg-slate-100" : "hover:bg-slate-100",
                    index === activeIndex && "ring-2 ring-inset ring-primary/50",
                  )}>
                  <span className="truncate">{movement.name}</span> <TrainingDays count={movement.trainingDays} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
