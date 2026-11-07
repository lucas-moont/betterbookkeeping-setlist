import { describe, expect, test } from "vitest";
import { findGaps, gapDurationLabel } from "./gaps";

describe("findGaps", () => {
  test("is empty when there are no Training Days", () => {
    expect(findGaps([], "2026-11-07")).toEqual([]);
  });

  test("14 days between two Training Days is no Gap", () => {
    expect(findGaps(["2026-10-01", "2026-10-15"], "2026-10-15")).toEqual([]);
  });

  test("15 days between two Training Days is a Gap, from the last one before it to the first one after", () => {
    expect(findGaps(["2026-10-01", "2026-10-16"], "2026-10-16")).toEqual([
      { from: "2026-10-01", to: "2026-10-16", days: 15, open: false },
    ]);
  });

  test("a Gap still going on runs to today, and is open", () => {
    expect(findGaps(["2026-10-01", "2026-10-03"], "2026-10-20")).toEqual([
      { from: "2026-10-03", to: "2026-10-20", days: 17, open: true },
    ]);
  });

  test("14 days since the last Training Day is no Gap yet", () => {
    expect(findGaps(["2026-10-03"], "2026-10-17")).toEqual([]);
  });

  test("counts calendar days across a month end", () => {
    expect(findGaps(["2026-10-25", "2026-11-09"], "2026-11-09")).toEqual([
      { from: "2026-10-25", to: "2026-11-09", days: 15, open: false },
    ]);
  });

  test("sorts the dates and ignores repeats, whatever order they come in", () => {
    expect(findGaps(["2026-12-01", "2026-10-01", "2026-10-05", "2026-10-01", "2026-12-10"], "2026-12-10")).toEqual([
      { from: "2026-10-05", to: "2026-12-01", days: 57, open: false },
    ]);
  });

  test("takes another minimum length", () => {
    expect(findGaps(["2026-10-01", "2026-10-08"], "2026-10-08", 7)).toEqual([
      { from: "2026-10-01", to: "2026-10-08", days: 7, open: false },
    ]);
  });
});

describe("gapDurationLabel", () => {
  test.each([
    [7, "1 week"],
    [15, "2 weeks"],
    [59, "8 weeks"],
    [60, "2 months"],
    [89, "2 months"],
    [400, "13 months"],
  ])("labels %s days as %j", (days, label) => {
    expect(gapDurationLabel(days)).toBe(label);
  });
});
