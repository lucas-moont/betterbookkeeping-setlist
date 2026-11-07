import { describe, expect, test } from "vitest";
import { setDraftSchema } from "./set-draft";

const validDraft = { movementId: crypto.randomUUID(), reps: 5, weight: 225 };

describe("setDraftSchema", () => {
  test.each([1, 8, 999])("accepts %s Reps", (reps) => {
    expect(setDraftSchema.safeParse({ ...validDraft, reps }).success).toBe(true);
  });

  test.each([0, 1.5, 1000])("refuses %s Reps", (reps) => {
    expect(setDraftSchema.safeParse({ ...validDraft, reps }).success).toBe(false);
  });

  // The two-decimal rule itself is tested with weightSchema in src/lib/weight.test.ts.
  test.each([0, 135.55])("accepts a Weight of %s", (weight) => {
    expect(setDraftSchema.safeParse({ ...validDraft, weight }).success).toBe(true);
  });

  test.each([-1, 1.005, 10000])("refuses a Weight of %s", (weight) => {
    expect(setDraftSchema.safeParse({ ...validDraft, weight }).success).toBe(false);
  });

  test.each([1, 10])("accepts a count of %s Sets", (count) => {
    expect(setDraftSchema.safeParse({ ...validDraft, count }).success).toBe(true);
  });

  test("accepts a draft without a count", () => {
    expect(setDraftSchema.safeParse(validDraft).success).toBe(true);
  });

  test.each([0, 1.5, 11])("refuses a count of %s Sets", (count) => {
    expect(setDraftSchema.safeParse({ ...validDraft, count }).success).toBe(false);
  });
});
