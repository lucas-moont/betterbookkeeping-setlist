import { describe, expect, test } from "vitest";
import { formatDate, formatWeight } from "./format";

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
  // 22:00 in São Paulo (UTC-3) is already the next day in UTC.
  const lateEveningInSaoPaulo = new Date("2026-11-07T01:00:00Z");

  test("uses the given time zone, not the server's", () => {
    expect(formatDate(lateEveningInSaoPaulo, "America/Sao_Paulo")).toBe("Nov 6, 2026");
    expect(formatDate(lateEveningInSaoPaulo, "UTC")).toBe("Nov 7, 2026");
  });

  test("spells the day out in the long style", () => {
    expect(formatDate(lateEveningInSaoPaulo, "America/Sao_Paulo", "long")).toBe("Friday, November 6, 2026");
  });
});
