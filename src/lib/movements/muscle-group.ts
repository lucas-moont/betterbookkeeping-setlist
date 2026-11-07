import { z } from "zod";
import { MuscleGroup } from "../../../prisma/generated/client/enums";

// The Muscle Groups (CONTEXT.md), straight from the database enum, in its order: the order a
// Workout's Muscle Groups come out in (ADR 0011). Prisma's enums file has no server code, so forms,
// server functions and modules can all import this.

export { MuscleGroup };

export const muscleGroups = Object.values(MuscleGroup);

export const muscleGroupSchema = z.enum(MuscleGroup);
