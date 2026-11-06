import { describe, expect, test } from "vitest";
import { isValidTimeZone, timeZoneFromCookie } from "./time-zone";

describe("isValidTimeZone", () => {
  // "UTC" and "Asia/Kolkata" are missing from Intl.supportedValuesOf("timeZone") on Node 24 (ADR 0004).
  test.each(["UTC", "America/Sao_Paulo", "Asia/Kolkata", "Etc/GMT+12", "Pacific/Kiritimati"])("accepts %s", (zone) => {
    expect(isValidTimeZone(zone)).toBe(true);
  });

  test.each(["", "Mars/Olympus", "not a zone", "America/Sao_Paulo".repeat(10)])("refuses %s", (zone) => {
    expect(isValidTimeZone(zone)).toBe(false);
  });

  // Intl accepts these, but Postgres reads "+05:30" in AT TIME ZONE as UTC-05:30, so the SQL would
  // put sets on other days than the screens show.
  test.each(["+05:30", "-03:00", "+14"])("refuses the offset %s", (zone) => {
    expect(isValidTimeZone(zone)).toBe(false);
  });
});

describe("timeZoneFromCookie", () => {
  test("reads a valid zone", () => {
    expect(timeZoneFromCookie("America%2FSao_Paulo")).toBe("America/Sao_Paulo");
    expect(timeZoneFromCookie("America/Sao_Paulo")).toBe("America/Sao_Paulo");
  });

  // The cookie comes from the browser, so anything can be in it. None of these may break a page.
  test.each([undefined, "", "Mars%2FOlympus", "%E0%A4%A", "UTC%"])("falls back to UTC for %s", (value) => {
    expect(timeZoneFromCookie(value)).toBe("UTC");
  });
});
