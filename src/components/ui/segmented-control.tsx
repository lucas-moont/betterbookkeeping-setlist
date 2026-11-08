import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string | number> = { value: T; label: string; icon?: LucideIcon };

/**
 * A few mutually exclusive choices side by side: Extra / Assistance, a chart's Metric or its period.
 * Each button carries its own border, so the row is exactly a field's height (44px on a phone, 40px
 * from sm up); the pressed one is selected the way a selected item is everywhere, Chalk Rust at 10%
 * with its own border, drawn over the neighbour's shared edge.
 */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  dense = false,
  className,
}: {
  /** The group's accessible name, such as "Metric". */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * Longer labels on a phone: equal-width buttons with 14px text, so "Max Weight / Total Reps /
   * Total Volume" fit the card. The buttons keep their 44px height.
   */
  dense?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex sm:inline-flex", className)}>
      {options.map((option, index) => {
        const pressed = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative inline-flex h-11 flex-1 items-center justify-center gap-1 whitespace-nowrap border px-2.5 text-base font-medium transition-colors sm:h-10 sm:flex-none sm:text-sm",
              "focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              dense && "min-w-0 text-sm max-sm:basis-0 max-sm:px-1.5",
              index > 0 && "-ml-px",
              index === 0 && "rounded-l-lg",
              index === options.length - 1 && "rounded-r-lg",
              pressed
                ? "z-10 border-primary bg-primary/10 text-primary"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}>
            {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
