import { useId } from "react";
import { muscleGroupLabels, type MuscleGroup } from "@/lib/movements/muscle-group";

/**
 * The Current Workout's Muscle Groups, as the server derives them from its Completed Sets. Nobody
 * picks them by hand, so nothing shows until a Completed Set brings one.
 */
export function MuscleGroups({ groups }: { groups: MuscleGroup[] }) {
  const labelId = useId();
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span id={labelId} className="mr-1 text-xs text-slate-500">
        Muscle groups
      </span>
      <ul aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {groups.map((group) => (
          <li
            key={group}
            className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2 text-xs font-medium text-slate-700">
            {muscleGroupLabels[group]}
          </li>
        ))}
      </ul>
    </div>
  );
}
