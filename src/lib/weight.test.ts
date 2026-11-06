import { describe, expect, test } from "vitest";
import { load, weightSchema } from "./weight";

describe("load", () => {
  test("is the Weight when there is no Added Weight", () => {
    expect(load({ weight: 225 })).toBe(225);
    expect(load({ weight: 225, addedWeight: null })).toBe(225);
  });

  test("adds the Added Weight to the Body Weight Snapshot", () => {
    expect(load({ weight: 180, addedWeight: 25 })).toBe(205);
  });

  test("subtracts assistance, which is a negative Added Weight", () => {
    expect(load({ weight: 180, addedWeight: -20.5 })).toBe(159.5);
  });

  // Postgres numeric gives 152.30 and 0.30 here; plain JavaScript gives 152.29999999999998 and
  // 0.30000000000000004, so a Max Weight compared across the two would not match (ADR 0002).
  test("rounds to two decimals, so it matches what Postgres computes", () => {
    expect(load({ weight: 150.1, addedWeight: 2.2 })).toBe(152.3);
    expect(load({ weight: 0.1, addedWeight: 0.2 })).toBe(0.3);
  });
});

describe("weightSchema", () => {
  test.each([0, 0.07, 1.15, 135.5, 135.55, 9999.99, -20.05, -9999.99])("accepts %s", (weight) => {
    expect(weightSchema.safeParse(weight).success).toBe(true);
  });

  // numeric(6,2) would round the first three to 1.01, 0.00 and 0.30 and overflow on the last two.
  test.each([1.005, 1e-7, 0.1 + 0.2, 10000, -10000])("refuses %s", (weight) => {
    expect(weightSchema.safeParse(weight).success).toBe(false);
  });
});
