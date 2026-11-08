import type { RefObject } from "react";
import { CalendarCheck, ListPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { WhenEmpty } from "@/lib/workouts";

interface EmptyWorkoutDialogProps {
  open: boolean;
  /** How many Sets the workout has, all of them Planned Sets. */
  plannedSets: number;
  /** The choice being saved, while it is. */
  pending: WhenEmpty | null;
  onChoose: (whenEmpty: WhenEmpty) => void;
  /** Keep logging: closes the dialog and leaves the workout as it is. Also Esc and a click on the scrim. */
  onKeepLogging: () => void;
  /** Where the focus goes after Keep logging: the next step is adding a set. */
  returnFocus: RefObject<HTMLElement | null>;
}

/**
 * What to do with a Current Workout that has no Completed Sets (CONTEXT.md, Gym Visit): save it as
 * a Gym Visit, discard it, or keep logging. None of the three is the default, so no button is filled
 * and the focus starts on the title (docs/research/empty-workouts.md).
 */
export function EmptyWorkoutDialog({
  open,
  plannedSets,
  pending,
  onChoose,
  onKeepLogging,
  returnFocus,
}: EmptyWorkoutDialogProps) {
  const notCompleted =
    plannedSets === 1 ? "The set in this workout isn't" : `None of the ${plannedSets} sets in this workout is`;
  const copy =
    plannedSets === 0
      ? {
          title: "This workout has no sets",
          description:
            "Save it as a gym visit to keep a record that you went, or discard it. Gym visits show in your history but not in your progress charts.",
        }
      : {
          title: "No sets completed yet",
          description: `${notCompleted} marked as completed. Save it as a gym visit to keep a record that you went (those sets stay as not completed), or discard it with its sets.`,
        };
  // Phones stack the choices full width, at the 44px touch height (DESIGN.md, Inputs and Selects).
  const choice = "h-11 w-full sm:h-10 sm:w-auto";

  return (
    <Dialog
      open={open}
      // While a choice is being saved, it can't be taken back.
      onClose={() => {
        if (!pending) onKeepLogging();
      }}
      title={copy.title}
      description={copy.description}
      initialFocus="title"
      returnFocus={returnFocus}
      className="max-w-xl">
      {/* The order follows the sentence above it, on every screen size. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className={choice} disabled={pending !== null} onClick={() => onChoose("save")}>
          <CalendarCheck className="w-4 h-4" aria-hidden="true" />
          {pending === "save" ? "Saving..." : "Save as gym visit"}
        </Button>
        <Button
          variant="destructive-outline"
          className={choice}
          disabled={pending !== null}
          onClick={() => onChoose("discard")}>
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          {pending === "discard" ? "Discarding..." : "Discard workout"}
        </Button>
        <Button variant="ghost" className={choice} disabled={pending !== null} onClick={onKeepLogging}>
          <ListPlus className="w-4 h-4" aria-hidden="true" />
          Keep logging
        </Button>
      </div>
    </Dialog>
  );
}
