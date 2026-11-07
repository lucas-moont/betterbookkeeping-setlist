import { cn } from "@/lib/utils";
import type { Movement } from "@/lib/movements";
import { muscleGroupLabels, muscleGroups, type MuscleGroup } from "@/lib/movements/muscle-group";

/** Which Movements the list shows: all of them, one Muscle Group, or the ones without a group. */
export type MuscleGroupFilterValue = "all" | "none" | MuscleGroup;

type FilterOption = { value: MuscleGroupFilterValue; label: string; count: number };

/**
 * The filters a list of Movements offers: All, each Muscle Group in use (in the fixed order), and
 * "No group" when some Movement has none. A group nobody uses has no filter.
 */
export function filterOptions(movements: Movement[]): FilterOption[] {
  const count = (group: MuscleGroup | null) => movements.filter((m) => m.muscleGroup === group).length;
  const groups = muscleGroups.map(
    (group): FilterOption => ({ value: group, label: muscleGroupLabels[group], count: count(group) }),
  );
  const all: FilterOption = { value: "all", label: "All", count: movements.length };
  const none: FilterOption = { value: "none", label: "No group", count: count(null) };
  return [all, ...groups, none].filter((option) => option.value === "all" || option.count > 0);
}

/** Whether the Movement shows under the filter. */
export function matchesFilter(movement: Movement, filter: MuscleGroupFilterValue): boolean {
  if (filter === "all") return true;
  return movement.muscleGroup === (filter === "none" ? null : filter);
}

interface MuscleGroupFilterProps {
  options: FilterOption[];
  value: MuscleGroupFilterValue;
  onChange: (value: MuscleGroupFilterValue) => void;
}

/** A row of toggle buttons with a count each; it scrolls sideways on a phone. */
export function MuscleGroupFilter({ options, value, onChange }: MuscleGroupFilterProps) {
  return (
    <div role="group" aria-label="Filter by muscle group" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors sm:h-8",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-gray-300 bg-white text-slate-600 hover:text-slate-900",
            )}>
            {option.label}
            <span className={cn("text-xs tabular-nums", active ? "text-white/70" : "text-slate-400")}>
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
