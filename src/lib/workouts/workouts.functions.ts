import { createServerFn } from "@tanstack/react-start";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { authMiddleware } from "@/lib/auth/auth.functions";
import { z } from "zod";
import { toServerResult } from "@/lib/error-codes";
import { readTimeZone } from "@/lib/time-zone";
import * as workouts from "./index";
import { historyCursorSchema, historyPageSizeSchema } from "./history-page";
import { setDraftSchema, type SetDraft } from "./set-draft";

// Thin adapters over the workouts module (ADR 0010): auth, input validation, the module call,
// and toServerResult for the error codes. The rules live in ./index.ts.

export const createWorkoutServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return toServerResult(await workouts.start(await getServerSidePrismaClient(), context.user.id));
  });

export const getCurrentWorkoutServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return workouts.get(await getServerSidePrismaClient(), context.user.id);
  });

// The user's choice for a workout with no Completed Sets, sent once the page has asked.
const completeWorkoutSchema = z.object({ whenEmpty: z.enum(workouts.whenEmptyChoices).optional() });

// One REPEATABLE READ transaction: discarding deletes the Sets, then the Workout, from the snapshot
// that found the workout empty, and never stops halfway (completeTransaction).
export const completeWorkoutServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(completeWorkoutSchema)
  .handler(
    async ({ context, data }: { context: { user: { id: string } }; data: { whenEmpty?: workouts.WhenEmpty } }) => {
      const db = await getServerSidePrismaClient();
      return toServerResult(
        await db.$transaction((tx) => workouts.complete(tx, context.user.id, data), workouts.completeTransaction),
      );
    },
  );

// One transaction: the first Body Weight Entry a body-weight Set records is saved with the Sets, or
// neither is. The user's today, for that entry, comes from the tz cookie (ADR 0003, ADR 0004).
export const addSetServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(setDraftSchema)
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: SetDraft }) => {
    const db = await getServerSidePrismaClient();
    const timeZone = readTimeZone();
    return toServerResult(await db.$transaction((tx) => workouts.addSet(tx, context.user.id, data, timeZone)));
  });

const setCompletedSchema = z.object({ setId: z.uuid(), completed: z.boolean() });

/** Which Set to complete (true) or un-complete (false). */
export type SetCompletedChange = z.infer<typeof setCompletedSchema>;

export const setCompletedServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(setCompletedSchema)
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: SetCompletedChange }) => {
    const db = await getServerSidePrismaClient();
    return toServerResult(await workouts.setCompleted(db, context.user.id, data.setId, data.completed));
  });

export const deleteSetServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ setId: z.uuid() }))
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { setId: string } }) => {
    return toServerResult(await workouts.removeSet(await getServerSidePrismaClient(), context.user.id, data.setId));
  });

// A page of the history: the cursor the previous page returned, and how many workouts a page shows.
const historyPageSchema = z.object({
  cursor: historyCursorSchema.optional(),
  limit: historyPageSizeSchema.optional(),
});

export const getWorkoutHistoryServerFn = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(historyPageSchema)
  .handler(
    async ({ context, data }: { context: { user: { id: string } }; data: z.infer<typeof historyPageSchema> }) => {
      return workouts.history(await getServerSidePrismaClient(), context.user.id, data);
    },
  );

export const deleteWorkoutsServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ workoutIds: z.array(z.uuid()) }))
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { workoutIds: string[] } }) => {
    return toServerResult(
      await workouts.deleteWorkouts(await getServerSidePrismaClient(), context.user.id, data.workoutIds),
    );
  });
