import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { authMiddleware } from "@/lib/auth/auth.functions";
import { toServerResult } from "@/lib/error-codes";
import { isoDateSchema } from "@/lib/iso-date";
import { readTimeZone } from "@/lib/time-zone";
import * as bodyWeight from "./index";
import type { NewBodyWeightEntry } from "./index";
import { bodyWeightEntrySchema } from "./entry";

// Thin adapters over the body-weight module (ADR 0010): auth, input validation, the module call, and
// toServerResult for the error codes. Entries belong to the signed-in user.

export const getBodyWeightEntriesServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return bodyWeight.list(await getServerSidePrismaClient(), context.user.id);
  });

// The user's today comes from the tz cookie, the same zone the form used for its default date.
export const recordBodyWeightServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(bodyWeightEntrySchema)
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: NewBodyWeightEntry }) => {
    const db = await getServerSidePrismaClient();
    return toServerResult(await bodyWeight.record(db, context.user.id, data, readTimeZone()));
  });

const entryDateSchema = z.object({ date: isoDateSchema });

export const deleteBodyWeightEntryServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(entryDateSchema)
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { date: string } }) => {
    return toServerResult(await bodyWeight.remove(await getServerSidePrismaClient(), context.user.id, data.date));
  });
