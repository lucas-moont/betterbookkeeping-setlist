import { createServerFn } from "@tanstack/react-start";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { authMiddleware } from "@/lib/auth/auth.functions";
import { toServerResult } from "@/lib/error-codes";
import { z } from "zod";
import * as movements from "./index";
import type { NewMovement } from "./index";
import { muscleGroupSchema } from "./muscle-group";
import { movementNameSchema } from "./name";

// Thin adapters over the movements module (ADR 0010): auth, input validation, the module call,
// and toServerResult for the error codes. Movements belong to the signed-in user (ADR 0001).

const newMovementSchema = z.object({ name: movementNameSchema, muscleGroup: muscleGroupSchema.nullish() });

export const createMovementServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(newMovementSchema)
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: NewMovement }) => {
    return toServerResult(await movements.create(await getServerSidePrismaClient(), context.user.id, data));
  });

const muscleGroupChangeSchema = z.object({ movementId: z.uuid(), muscleGroup: muscleGroupSchema.nullable() });

/** Which Movement gets which Muscle Group; null takes it away. */
export type MuscleGroupChange = z.infer<typeof muscleGroupChangeSchema>;

export const setMovementMuscleGroupServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(muscleGroupChangeSchema)
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: MuscleGroupChange }) => {
    const db = await getServerSidePrismaClient();
    return toServerResult(await movements.setMuscleGroup(db, context.user.id, data.movementId, data.muscleGroup));
  });

export const getMovementsServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return movements.list(await getServerSidePrismaClient(), context.user.id);
  });
