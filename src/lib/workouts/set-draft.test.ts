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

describe("setDraftSchema with Added Weight", () => {
  test.each([
    [25, "weighted vest"],
    [-20, "red band"],
    [0.01, "x"],
  ])("accepts an Added Weight of %s with the note %j", (addedWeight, addedWeightNote) => {
    expect(setDraftSchema.safeParse({ ...validDraft, addedWeight, addedWeightNote }).success).toBe(true);
  });

  test("trims the note", () => {
    const parsed = setDraftSchema.parse({ ...validDraft, addedWeight: 25, addedWeightNote: "  dip belt  " });

    expect(parsed.addedWeightNote).toBe("dip belt");
  });

  test("accepts a note of 60 characters", () => {
    const draft = { ...validDraft, addedWeight: 25, addedWeightNote: "x".repeat(60) };

    expect(setDraftSchema.safeParse(draft).success).toBe(true);
  });

  // The two-decimal rule and the range come from weightSchema, tested in src/lib/weight.test.ts.
  test.each([0, 1.005, -10000])("refuses an Added Weight of %s", (addedWeight) => {
    expect(setDraftSchema.safeParse({ ...validDraft, addedWeight, addedWeightNote: "vest" }).success).toBe(false);
  });

  test.each(["", "   ", "x".repeat(61)])("refuses the note %j", (addedWeightNote) => {
    expect(setDraftSchema.safeParse({ ...validDraft, addedWeight: 25, addedWeightNote }).success).toBe(false);
  });

  // The messages are the copy the form shows beside the field.
  const describeIt = 'Describe the added weight, for example "weighted vest".';

  test("refuses an Added Weight without a note, with the error on the note", () => {
    const result = setDraftSchema.safeParse({ ...validDraft, addedWeight: 25 });

    expect(result.error?.issues.map(({ path, message }) => ({ path, message }))).toEqual([
      { path: ["addedWeightNote"], message: describeIt },
    ]);
  });

  test("refuses a blank note with the same message", () => {
    const result = setDraftSchema.safeParse({ ...validDraft, addedWeight: 25, addedWeightNote: "   " });

    expect(result.error?.issues.map(({ path, message }) => ({ path, message }))).toEqual([
      { path: ["addedWeightNote"], message: describeIt },
    ]);
  });

  test("refuses a note without an Added Weight, with the error on the Added Weight", () => {
    const result = setDraftSchema.safeParse({ ...validDraft, addedWeightNote: "dip belt" });

    expect(result.error?.issues.map(({ path, message }) => ({ path, message }))).toEqual([
      { path: ["addedWeight"], message: "Enter the added weight, or remove it." },
    ]);
  });
});
