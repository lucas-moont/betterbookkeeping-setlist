import { createServerFn } from "@tanstack/react-start";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { authMiddleware } from "@/lib/auth/auth.functions";
import { z } from "zod";
import { toServerResult } from "@/lib/error-codes";
import * as workouts from "./index";
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

export const completeWorkoutServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return toServerResult(await workouts.complete(await getServerSidePrismaClient(), context.user.id));
  });

export const addSetServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(setDraftSchema)
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: SetDraft }) => {
    return toServerResult(await workouts.addSet(await getServerSidePrismaClient(), context.user.id, data));
  });

export const deleteSetServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ setId: z.string() }))
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { setId: string } }) => {
    const prisma = await getServerSidePrismaClient();
    // Verify the set belongs to the user's active workout
    const set = await prisma.set.findFirst({
      where: { id: data.setId, workout: { userId: context.user.id, completedAt: null } },
    });
    if (!set) {
      return { success: false, error: "Set not found" };
    }
    await prisma.set.delete({ where: { id: data.setId } });
    return { success: true };
  });

export const getWorkoutHistoryServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return workouts.history(await getServerSidePrismaClient(), context.user.id);
  });

export const deleteWorkoutsServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ workoutIds: z.array(z.string()) }))
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { workoutIds: string[] } }) => {
    const prisma = await getServerSidePrismaClient();
    // Delete sets first, then workouts (only for this user's workouts)
    await prisma.set.deleteMany({
      where: { workout: { id: { in: data.workoutIds }, userId: context.user.id } },
    });
    await prisma.workout.deleteMany({
      where: { id: { in: data.workoutIds }, userId: context.user.id },
    });
    return { success: true };
  });
