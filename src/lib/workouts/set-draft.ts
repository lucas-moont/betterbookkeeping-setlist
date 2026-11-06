import { z } from "zod";
import { weightSchema } from "@/lib/weight";

/** The most Reps one Set can have. */
export const maxReps = 999;

// A Set as the Current Workout form sends it. Free of server code, so the form, the mutation and
// the server function's inputValidator share one definition.
export const setDraftSchema = z.object({
  movementId: z.uuid(),
  reps: z.number().int().min(1).max(maxReps),
  weight: weightSchema.min(0),
});

export type SetDraft = z.infer<typeof setDraftSchema>;
