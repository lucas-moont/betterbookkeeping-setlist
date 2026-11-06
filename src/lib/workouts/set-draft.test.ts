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
});
