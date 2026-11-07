import { describe, expect, test } from "vitest";
import { bodyWeightEntrySchema, latestEntry } from "./entry";

describe("bodyWeightEntrySchema", () => {
  test("accepts a date and a weight with up to two decimals", () => {
    expect(bodyWeightEntrySchema.safeParse({ date: "2026-11-06", weight: 172.45 }).success).toBe(true);
  });

  test.each([0, -1, 172.456, 10000])("refuses the weight %s", (weight) => {
    expect(bodyWeightEntrySchema.safeParse({ date: "2026-11-06", weight }).success).toBe(false);
  });

  test("says why a weight is too heavy", () => {
    const result = bodyWeightEntrySchema.safeParse({ date: "2026-11-06", weight: 10000 });
    expect(result.error?.issues[0]?.message).toBe("Enter a weight up to 9999.99");
  });

  test("refuses a date that doesn't exist", () => {
    expect(bodyWeightEntrySchema.safeParse({ date: "2026-02-30", weight: 172.4 }).success).toBe(false);
  });
});

describe("latestEntry", () => {
  test("is the entry with the most recent date, in any order", () => {
    const entries = [
      { date: "2026-10-20", weight: 175 },
      { date: "2026-11-03", weight: 172.4 },
      { date: "2026-09-01", weight: 178 },
    ];
    expect(latestEntry(entries)).toEqual({ date: "2026-11-03", weight: 172.4 });
  });

  test("is undefined without entries", () => {
    expect(latestEntry([])).toBeUndefined();
  });
});
