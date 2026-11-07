import { describe, expect, test } from "vitest";
import { isoDateSchema, isoDateToUtc, utcToIsoDate } from "./iso-date";

describe("isoDateToUtc and utcToIsoDate", () => {
  test("turn a date into its UTC midnight and back", () => {
    expect(isoDateToUtc("2026-11-06").toISOString()).toBe("2026-11-06T00:00:00.000Z");
    expect(utcToIsoDate(isoDateToUtc("2026-11-06"))).toBe("2026-11-06");
  });
});

describe("isoDateSchema", () => {
  test.each(["2026-11-06", "2024-02-29", "1999-12-31"])("accepts %s", (value) => {
    expect(isoDateSchema.safeParse(value).success).toBe(true);
  });

  test.each([
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "2026-11-6",
    "11/06/2026",
    "2026-11-06T00:00:00Z",
    "",
    "0202-11-06",
    "1899-12-31",
  ])("refuses %s", (value) => {
    expect(isoDateSchema.safeParse(value).success).toBe(false);
  });
});
