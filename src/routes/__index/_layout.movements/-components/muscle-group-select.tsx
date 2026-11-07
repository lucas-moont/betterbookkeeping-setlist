import { Select, type SelectProps } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { muscleGroupLabels, muscleGroups, type MuscleGroup } from "@/lib/movements/muscle-group";

interface MuscleGroupSelectProps extends Omit<SelectProps, "value" | "onChange"> {
  value: MuscleGroup | null;
  onChange: (muscleGroup: MuscleGroup | null) => void;
}

/** The Muscle Groups in their fixed order, plus "No muscle group" (a Movement may have none). */
export function MuscleGroupSelect({ value, onChange, className, ...props }: MuscleGroupSelectProps) {
  return (
    <Select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as MuscleGroup))}
      className={cn("h-11 text-base sm:h-10 sm:text-sm", className)}
      {...props}>
      <option value="">No muscle group</option>
      {muscleGroups.map((group) => (
        <option key={group} value={group}>
          {muscleGroupLabels[group]}
        </option>
      ))}
    </Select>
  );
}
