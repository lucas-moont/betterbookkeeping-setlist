import { createServerFn } from "@tanstack/react-start";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { authMiddleware } from "@/lib/auth/auth.functions";
import { toServerResult } from "@/lib/error-codes";
import { z } from "zod";
import * as movements from "./index";
import { movementNameSchema } from "./name";

// Thin adapters over the movements module (ADR 0010): auth, input validation, the module call,
// and toServerResult for the error codes. Movements belong to the signed-in user (ADR 0001).

const newMovementSchema = z.object({ name: movementNameSchema });

export const createMovementServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(newMovementSchema)
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { name: string } }) => {
    return toServerResult(await movements.create(await getServerSidePrismaClient(), context.user.id, data.name));
  });

export const getMovementsServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return movements.list(await getServerSidePrismaClient(), context.user.id);
  });
