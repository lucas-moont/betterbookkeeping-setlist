import { describe, expect, test } from "vitest";
import { dateToTimestamp, monthTicks, tickShowsYear, timeDomain, timestampToDate, valueDomain } from "./time-axis";

const t = dateToTimestamp;

describe("dateToTimestamp", () => {
  test("is UTC midnight and goes back to the same date", () => {
    expect(new Date(t("2026-11-06")).toISOString()).toBe("2026-11-06T00:00:00.000Z");
    expect(timestampToDate(t("2026-11-06"))).toBe("2026-11-06");
  });
});

describe("timeDomain", () => {
  test("runs from the first date to today", () => {
    expect(timeDomain("2026-06-10", "2026-11-06")).toEqual([t("2026-06-10"), t("2026-11-06")]);
  });

  test("spans at least 14 days, ending today, for a recent first date", () => {
    expect(timeDomain("2026-11-03", "2026-11-06")).toEqual([t("2026-10-23"), t("2026-11-06")]);
  });

  test("spans 14 days when the only date is today", () => {
    expect(timeDomain("2026-11-06", "2026-11-06")).toEqual([t("2026-10-23"), t("2026-11-06")]);
  });
});

describe("monthTicks", () => {
  test("puts a tick on the first of each month inside the domain", () => {
    expect(monthTicks([t("2026-08-15"), t("2026-11-06")])).toEqual({
      ticks: [t("2026-09-01"), t("2026-10-01"), t("2026-11-01")],
      monthly: true,
    });
  });

  test("crosses the year", () => {
    expect(monthTicks([t("2026-11-20"), t("2027-02-10")]).ticks).toEqual([
      t("2026-12-01"),
      t("2027-01-01"),
      t("2027-02-01"),
    ]);
  });

  test("keeps every n-th month when there are more than the maximum", () => {
    const { ticks } = monthTicks([t("2025-11-06"), t("2026-11-06")], 6);
    expect(ticks.map(timestampToDate)).toEqual([
      "2025-12-01",
      "2026-02-01",
      "2026-04-01",
      "2026-06-01",
      "2026-08-01",
      "2026-10-01",
    ]);
  });

  test("includes the first month when the domain starts on the 1st", () => {
    expect(monthTicks([t("2026-10-01"), t("2026-11-06")]).ticks).toEqual([t("2026-10-01"), t("2026-11-01")]);
    expect(monthTicks([t("2026-11-01"), t("2026-11-15")])).toEqual({ ticks: [t("2026-11-01")], monthly: true });
  });

  test("falls back to the two ends when no month starts inside the domain", () => {
    expect(monthTicks([t("2026-11-02"), t("2026-11-16")])).toEqual({
      ticks: [t("2026-11-02"), t("2026-11-16")],
      monthly: false,
    });
  });
});

describe("tickShowsYear", () => {
  test("names the year on the first tick and wherever the year changes, even when January was thinned out", () => {
    const { ticks } = monthTicks([t("2025-11-06"), t("2026-11-06")], 6);
    expect(ticks.map((_, i) => tickShowsYear(ticks, i))).toEqual([true, true, false, false, false, false]);
  });
});

describe("valueDomain", () => {
  test("leaves room around close values with a step of one", () => {
    expect(valueDomain([172.2, 174.8])).toEqual({ domain: [171, 176], ticks: [171, 172, 173, 174, 175, 176] });
  });

  test("widens to a round step for a wider range", () => {
    expect(valueDomain([172.2, 178.8])).toEqual({ domain: [170, 180], ticks: [170, 172, 174, 176, 178, 180] });
  });

  test("gives a single value room above and below", () => {
    expect(valueDomain([172.4])).toEqual({ domain: [171, 174], ticks: [171, 172, 173, 174] });
  });
});
