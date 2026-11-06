// The one place screens turn weights and dates into text. Free of server code, so the server render
// and the browser produce the same strings. The locale lives here alone, which is what a future
// translation would replace.

const locale = "en-US";

const weightFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

/** A Weight or Load in pounds, as the screens show it: "135.5 lb". */
export function formatWeight(pounds: number): string {
  return `${weightFormat.format(pounds)} lb`;
}
