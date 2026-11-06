// The one place screens turn weights and dates into text. Free of server code, so the server render
// and the browser produce the same strings. The locale lives here alone, which is what a future
// translation would replace.

const locale = "en-US";

const weightFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

/** A Weight or Load in pounds, as the screens show it: "135.5 lb". */
export function formatWeight(pounds: number): string {
  return `${weightFormat.format(pounds)} lb`;
}

const dateStyles = {
  short: { month: "short", day: "numeric", year: "numeric" },
  long: { weekday: "long", month: "long", day: "numeric", year: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

type DateStyle = keyof typeof dateStyles;

/**
 * An instant (such as completedAt) as the date it was in the user's time zone: "Nov 6, 2026", or
 * "Friday, November 6, 2026" in the long style. The zone comes from useTimeZone(); the server's own
 * zone would show São Paulo's evening as the next day.
 */
export function formatDate(instant: Date, timeZone: string, style: DateStyle = "short"): string {
  return new Intl.DateTimeFormat(locale, { ...dateStyles[style], timeZone }).format(instant);
}

// Calendar dates (a Body Weight Entry's day, a Training Day) have no time of day, so they travel as
// "YYYY-MM-DD" text (ADR 0004). Read as an instant, "2026-11-06" is UTC midnight, which São Paulo
// shows as Nov 5; these two helpers never let that happen.

/** Today's calendar date in the user's time zone, as "YYYY-MM-DD". */
export function todayIsoDate(timeZone: string, now: Date = new Date()): string {
  // Not the display locale: this builds machine text, which needs ASCII digits in any language.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** A "YYYY-MM-DD" calendar date as text, the same day in every time zone: "Nov 6, 2026". */
export function formatCalendarDate(isoDate: string, style: DateStyle = "short"): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  // Both the instant and the formatting use UTC, so the zone the code runs in can't move the day.
  return formatDate(new Date(Date.UTC(year, month - 1, day)), "UTC", style);
}
