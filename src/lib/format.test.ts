import { afterEach, describe, expect, test } from "vitest";
import { formatCalendarDate, formatDate, formatWeight, todayIsoDate } from "./format";

// 22:00 in São Paulo (UTC-3) is already the next day in UTC.
const lateEveningInSaoPaulo = new Date("2026-11-07T01:00:00Z");

describe("formatWeight", () => {
  test.each([
    [135.5, "135.5 lb"],
    [135.55, "135.55 lb"],
    [225, "225 lb"],
    [0, "0 lb"],
    [-20.5, "-20.5 lb"],
    [9999.99, "9,999.99 lb"],
  ])("shows %s as %s", (weight, text) => {
    expect(formatWeight(weight)).toBe(text);
  });

  // Weights already arrive with at most two decimals; this only guards a sum computed in JavaScript.
  test("rounds to two decimals", () => {
    expect(formatWeight(150.1 + 2.2)).toBe("152.3 lb");
  });
});

describe("formatDate", () => {
  test("uses the given time zone, not the server's", () => {
    expect(formatDate(lateEveningInSaoPaulo, "America/Sao_Paulo")).toBe("Nov 6, 2026");
    expect(formatDate(lateEveningInSaoPaulo, "UTC")).toBe("Nov 7, 2026");
  });

  test("spells the day out in the long style", () => {
    expect(formatDate(lateEveningInSaoPaulo, "America/Sao_Paulo", "long")).toBe("Friday, November 6, 2026");
  });
});

describe("todayIsoDate", () => {
  test("is the calendar date in the given time zone", () => {
    expect(todayIsoDate("America/Sao_Paulo", lateEveningInSaoPaulo)).toBe("2026-11-06");
    expect(todayIsoDate("UTC", lateEveningInSaoPaulo)).toBe("2026-11-07");
    expect(todayIsoDate("Pacific/Kiritimati", new Date("2026-01-05T10:30:00Z"))).toBe("2026-01-06");
  });
});

describe("formatCalendarDate", () => {
  const serverTimeZone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = serverTimeZone;
  });

  // A date with no time of day: "2026-11-06" read as UTC midnight and shown in São Paulo would be
  // Nov 5, so the result must not depend on the zone the code runs in.
  test("shows the same day in any time zone", () => {
    process.env.TZ = "America/Sao_Paulo";
    expect(formatCalendarDate("2026-11-06")).toBe("Nov 6, 2026");
    process.env.TZ = "Pacific/Kiritimati";
    expect(formatCalendarDate("2026-11-06")).toBe("Nov 6, 2026");
  });

  test("round-trips today", () => {
    const today = todayIsoDate("America/Sao_Paulo", lateEveningInSaoPaulo);
    expect(formatCalendarDate(today, "long")).toBe("Friday, November 6, 2026");
  });
});
