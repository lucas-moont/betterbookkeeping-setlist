import { z } from "zod";
import { weightSchema } from "@/lib/weight";

/** The most Reps one Set can have. */
export const maxReps = 999;

/** The most identical Sets one addSet can add at once. */
export const maxSetCount = 10;

// The form shows these messages beside the field, so they are its copy.
const addedWeightNoteMissing = 'Describe the added weight, for example "weighted vest".';

/** The longest description of how an Added Weight was added; the column is varchar(60). */
export const maxAddedWeightNoteLength = 60;

// A Set as the Current Workout form sends it. Free of server code, so the form, the mutation and
// the server function's inputValidator share one definition. For a Body-weight Movement the server
// replaces weight with the Latest Body Weight, unless the user has none yet (ADR 0003).
export const setDraftSchema = z
  .object({
    movementId: z.uuid(),
    reps: z.number().int().min(1).max(maxReps),
    weight: weightSchema.min(0),
    count: z.number().int().min(1).max(maxSetCount).optional(),
    // Signed: positive is extra load, negative is assistance. Zero would be no Added Weight at all.
    addedWeight: weightSchema.refine((weight) => weight !== 0, "Enter an added weight other than 0").optional(),
    addedWeightNote: z
      .string()
      .trim()
      .min(1, addedWeightNoteMissing)
      .max(maxAddedWeightNoteLength, `Use at most ${maxAddedWeightNoteLength} characters`)
      .optional(),
  })
  // Added Weight always comes with its note, and a note never comes alone. The issue goes on the
  // field that is missing, so the form shows it there.
  .superRefine(({ addedWeight, addedWeightNote }, ctx) => {
    if (addedWeight !== undefined && addedWeightNote === undefined) {
      ctx.addIssue({ code: "custom", path: ["addedWeightNote"], message: addedWeightNoteMissing });
    }
    if (addedWeight === undefined && addedWeightNote !== undefined) {
      ctx.addIssue({ code: "custom", path: ["addedWeight"], message: "Enter the added weight, or remove it." });
    }
  });

export type SetDraft = z.infer<typeof setDraftSchema>;
