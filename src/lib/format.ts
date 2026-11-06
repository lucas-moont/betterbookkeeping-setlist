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

/**
 * An instant (such as completedAt) as the date it was in the user's time zone: "Nov 6, 2026", or
 * "Friday, November 6, 2026" in the long style. The zone comes from useTimeZone(); the server's own
 * zone would show São Paulo's evening as the next day.
 */
export function formatDate(instant: Date, timeZone: string, style: keyof typeof dateStyles = "short"): string {
  return new Intl.DateTimeFormat(locale, { ...dateStyles[style], timeZone }).format(instant);
}
