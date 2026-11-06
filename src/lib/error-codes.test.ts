import { describe, expect, test } from "vitest";
import { toServerResult, unwrap } from "./error-codes";

describe("toServerResult", () => {
  test("turns a success into { success: true } with the data beside it", () => {
    expect(toServerResult({ ok: true, set: { id: "set-1" } })).toEqual({ success: true, set: { id: "set-1" } });
  });

  test("turns a failure into its code and the message for that code", () => {
    expect(toServerResult({ ok: false, reason: "set-not-found" })).toEqual({
      success: false,
      code: "set-not-found",
      error: "Set not found",
    });
    expect(toServerResult({ ok: false, reason: "no-current-workout" })).toEqual({
      success: false,
      code: "no-current-workout",
      error: "There is no Current Workout",
    });
    expect(toServerResult({ ok: false, reason: "movement-name-taken" })).toEqual({
      success: false,
      code: "movement-name-taken",
      error: "You already have a movement with this name",
    });
    expect(toServerResult({ ok: false, reason: "movement-not-found" })).toEqual({
      success: false,
      code: "movement-not-found",
      error: "Movement not found",
    });
  });
});

describe("unwrap", () => {
  test("hands a success back as it is", () => {
    const result = { success: true as const, set: { id: "set-1" } };

    expect(unwrap(result)).toBe(result);
  });

  // TanStack Query only runs onError (the toast, a form message) and skips the invalidation for a
  // mutation that throws, so a failure must not come back as a value.
  test("throws a failure as a ServerResultError with its code and message", () => {
    const failure = { success: false as const, code: "movement-name-taken" as const, error: "You already have a movement with this name" };

    expect(() => unwrap(failure)).toThrow(
      expect.objectContaining({
        name: "ServerResultError",
        code: "movement-name-taken",
        message: "You already have a movement with this name",
      }),
    );
  });
});
