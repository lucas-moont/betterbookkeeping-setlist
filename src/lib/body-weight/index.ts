import { createServerOnlyFn } from "@tanstack/react-start";
import type { DbClient } from "@/lib/db.server";
import type { Result } from "@/lib/error-codes";
import { todayIsoDate } from "@/lib/format";
import { isoDateToUtc, utcToIsoDate } from "@/lib/iso-date";

// The body-weight module (ADR 0010): each user's Body Weight Entries, at most one per calendar date.
// Every operation takes (db, userId, ...) and only ever touches that user's rows. Dates come in and
// go out as "YYYY-MM-DD" text, never as a Date, so no time zone can move the day (ADR 0004).

export type BodyWeightEntry = { date: string; weight: number };

/** What recording a body weight takes: a valid "YYYY-MM-DD" date and a valid Weight in pounds. */
export type NewBodyWeightEntry = BodyWeightEntry;

const entrySelect = { date: true, weight: true } as const;

type EntryRow = { date: Date; weight: { toNumber(): number } };

// Prisma reads and writes a Postgres date as UTC midnight. Formatting that Date in any other zone
// could show the day before, so it only ever goes through the iso-date helpers.
function toEntry(row: EntryRow): BodyWeightEntry {
  return { date: utcToIsoDate(row.date), weight: row.weight.toNumber() };
}

const toDbDate = isoDateToUtc;

/** The user's Body Weight Entries, newest date first. */
export const list = createServerOnlyFn(async (db: DbClient, userId: string): Promise<BodyWeightEntry[]> => {
  const rows = await db.bodyWeightEntry.findMany({ where: { userId }, orderBy: { date: "desc" }, select: entrySelect });
  return rows.map(toEntry);
});

/**
 * Records the user's body weight for a date, replacing the weight already recorded for that date.
 * A date after the user's today, in their time zone, returns body-weight-date-in-future: it would
 * become the Latest Body Weight and be copied into every new set until that day came (ADR 0003).
 */
export const record = createServerOnlyFn(
  async (
    db: DbClient,
    userId: string,
    { date, weight }: NewBodyWeightEntry,
    timeZone: string,
  ): Promise<Result<{ entry: BodyWeightEntry }, "body-weight-date-in-future">> => {
    // Both are "YYYY-MM-DD", so comparing the text compares the dates.
    if (date > todayIsoDate(timeZone)) return { ok: false, reason: "body-weight-date-in-future" };

    // The unique (userId, date) index makes this one entry per date, even with two requests at once.
    const row = await db.bodyWeightEntry.upsert({
      where: { userId_date: { userId, date: toDbDate(date) } },
      create: { userId, date: toDbDate(date), weight },
      update: { weight },
      select: entrySelect,
    });
    return { ok: true, entry: toEntry(row) };
  },
);

/**
 * The Latest Body Weight: the entry with the most recent date, or null when the user has none. The
 * date decides, not the order of recording, so correcting an old date never changes it.
 */
export const latest = createServerOnlyFn(async (db: DbClient, userId: string): Promise<BodyWeightEntry | null> => {
  const row = await db.bodyWeightEntry.findFirst({ where: { userId }, orderBy: { date: "desc" }, select: entrySelect });
  return row ? toEntry(row) : null;
});
