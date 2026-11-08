import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { authMiddleware } from "@/lib/auth/auth.functions";
import { toServerResult } from "@/lib/error-codes";
import { readTimeZone } from "@/lib/time-zone";
import * as progression from "./index";

// Thin adapters over the progression module (ADR 0010): auth, input validation, the module call,
// and toServerResult for the error codes. Training Days are dates in the zone of the tz cookie, the
// same one the query key carries (ADR 0004).

const metricsRequestSchema = z.object({ movementId: z.uuid() });

export const getProgressionServerFn = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(metricsRequestSchema)
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { movementId: string } }) => {
    const db = await getServerSidePrismaClient();
    return toServerResult(await progression.getMetrics(db, context.user.id, data.movementId, readTimeZone()));
  });

export const getProgressionMovementsServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const db = await getServerSidePrismaClient();
    return toServerResult(await progression.listMovements(db, context.user.id, readTimeZone()));
  });
