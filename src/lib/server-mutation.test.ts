import { describe, expect, test } from "vitest";
import { ServerResultError } from "@/lib/error-codes";
import { errorToastMessage, isFormError } from "./server-mutation";

// Decides which errors the global toast in src/router.tsx leaves to the page's form.
describe("isFormError", () => {
  const taken = new ServerResultError("movement-name-taken", "You already have a movement with this name");

  test("is true for a code the mutation lists in formErrors", () => {
    expect(isFormError(taken, { formErrors: ["movement-name-taken"] })).toBe(true);
  });

  test("is false for a code the mutation doesn't list", () => {
    expect(isFormError(taken, { formErrors: ["movement-not-found"] })).toBe(false);
    expect(isFormError(taken, {})).toBe(false);
    expect(isFormError(taken, undefined)).toBe(false);
  });

  test("is false for any other error, such as the network failing", () => {
    expect(isFormError(new Error("Failed to fetch"), { formErrors: ["movement-name-taken"] })).toBe(false);
  });
});

describe("errorToastMessage", () => {
  test("is the message of the error code", () => {
    expect(errorToastMessage(new ServerResultError("set-not-found", "Set not found"))).toBe("Set not found");
  });

  // An unexpected error can carry a Prisma or zod message that names tables and columns.
  test("is a generic message for anything else, so internal details never reach the screen", () => {
    const prismaError = new Error('Invalid `prisma.set.create()` invocation: Argument `reps`: Invalid value provided. Expected Int');

    expect(errorToastMessage(prismaError)).toBe("Something went wrong. Please try again.");
  });
});
