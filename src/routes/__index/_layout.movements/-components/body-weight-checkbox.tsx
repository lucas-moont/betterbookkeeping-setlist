import { cn } from "@/lib/utils";

interface BodyWeightCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

/** The flag that makes a Movement a Body-weight Movement (CONTEXT.md). */
export function BodyWeightCheckbox({ checked, onChange, className }: BodyWeightCheckboxProps) {
  return (
    <label
      className={cn(
        "inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap text-base font-medium text-gray-700 sm:h-10 sm:text-sm",
        className,
      )}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-primary"
      />
      Body-weight
    </label>
  );
}
