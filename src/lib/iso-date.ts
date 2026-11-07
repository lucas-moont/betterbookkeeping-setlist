import { z } from "zod";

// Calendar dates travel between the browser and the server as "YYYY-MM-DD" text (ADR 0004). Pure and
// free of server code, so a form can validate with the same schema the server function uses. A
// calendar date becomes an instant only as its UTC midnight, and only through these two helpers, so
// no time zone can move the day.

/** A "YYYY-MM-DD" date as the instant of its UTC midnight, the way Postgres `date` columns come back. */
export function isoDateToUtc(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** A UTC-midnight instant back to its "YYYY-MM-DD" date. */
export function utcToIsoDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/** The earliest date a Setlist record can carry; anything older is a mistyped year. */
export const earliestIsoDate = "1900-01-01";

/** A real calendar date written as "YYYY-MM-DD". "2026-02-30" has the right shape but is refused. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .refine((value) => {
    const date = isoDateToUtc(value);
    // Zod runs this even after the regex fails, so text that isn't a date at all must not throw.
    if (Number.isNaN(date.getTime())) return false;
    // Date.UTC rolls an impossible day over into the next month, which changes the text.
    return utcToIsoDate(date) === value;
  }, "Pick a real date")
  // A year typed as "0202" would stretch every chart over eighteen centuries.
  .refine((value) => value >= earliestIsoDate, "Pick a date after 1900");
