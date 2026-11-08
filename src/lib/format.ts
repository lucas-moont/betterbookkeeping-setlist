// The one place screens turn weights and dates into text. Free of server code, so the server render
// and the browser produce the same strings. The locale lives here alone, which is what a future
// translation would replace.

const locale = "en-US";

// Any number a screen shows: weights and counts alike, with grouping and at most two decimals.
const amountFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

/** The unit every weight is in (ADR 0002), for a field that shows it beside the number. */
export const weightUnit = "lb";

/** The unit spelled out, for labels a screen reader reads: "Weight in pounds". */
export const weightUnitName = "pounds";

/** A weight's number without the unit, for a chart axis whose unit is said elsewhere: "135.5". */
export function formatWeightAmount(pounds: number): string {
  return amountFormat.format(pounds);
}

/** A count with no unit, such as a Total Reps: "1,240". */
export function formatCount(count: number): string {
  return amountFormat.format(count);
}

/** A Weight or Load in pounds, as the screens show it: "135.5 lb". */
export function formatWeight(pounds: number): string {
  return `${formatWeightAmount(pounds)} ${weightUnit}`;
}

const dateStyles = {
  short: { month: "short", day: "numeric", year: "numeric" },
  medium: { weekday: "short", month: "short", day: "numeric", year: "numeric" },
  long: { weekday: "long", month: "long", day: "numeric", year: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

type DateStyle = keyof typeof dateStyles;

/**
 * An instant (such as completedAt) as the date it was in the user's time zone: "Nov 6, 2026",
 * "Fri, Nov 6, 2026" in the medium style, or "Friday, November 6, 2026" in the long style. The zone
 * comes from useTimeZone(); the server's own zone would show São Paulo's evening as the next day.
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

/**
 * A "YYYY-MM-DD" date as its month, for a chart's time axis: "Nov", or "Nov 2026" with the year. The
 * axis asks for the year where a reader needs it (see time-axis.ts).
 */
export function formatCalendarMonth(isoDate: string, { withYear = false } = {}): string {
  const [year, month] = isoDate.split("-").map(Number);
  const options: Intl.DateTimeFormatOptions = withYear
    ? { month: "short", year: "numeric", timeZone: "UTC" }
    : { month: "short", timeZone: "UTC" };
  return new Intl.DateTimeFormat(locale, options).format(new Date(Date.UTC(year, month - 1, 1)));
}
