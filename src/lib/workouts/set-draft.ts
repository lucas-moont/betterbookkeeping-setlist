import { z } from "zod";

// A Set as the Current Workout form sends it. Free of server code, so the form, the mutation and
// the server function's inputValidator share one definition.
export const setDraftSchema = z.object({
  movementId: z.uuid(),
  reps: z.number().min(1),
  weight: z.number().min(0),
});

export type SetDraft = z.infer<typeof setDraftSchema>;
