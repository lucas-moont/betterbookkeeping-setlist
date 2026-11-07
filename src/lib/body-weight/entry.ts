import { z } from "zod";
import { isoDateSchema } from "@/lib/iso-date";
import { weightSchema } from "@/lib/weight";

// Pure and free of server code, so the record form validates with the same rules as the server
// function. The future-date rule needs the user's today, so the module checks it (ADR 0003).

/** A body weight: a Weight in pounds (ADR 0002) above 0. */
export const bodyWeightSchema = weightSchema.positive("Enter a weight above 0");

/**
 * The Latest Body Weight among entries: the one with the most recent date, or undefined when there
 * are none. The module's latest() reads the same rule from the database.
 */
export function latestEntry<T extends { date: string }>(entries: readonly T[]): T | undefined {
  return entries.reduce<T | undefined>(
    (newest, entry) => (!newest || entry.date > newest.date ? entry : newest),
    undefined,
  );
}

/** What recording a body weight sends: the calendar date and the weight. */
export const bodyWeightEntrySchema = z.object({ date: isoDateSchema, weight: bodyWeightSchema });
