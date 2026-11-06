import { z } from "zod";

// The rules for a Movement name (ADR 0001). Free of server code, so the Movements form, the server
// function's inputValidator and the module share one definition.

export const movementNameMaxLength = 100;

/** A Movement name as the user types it: trimmed, not empty, at most 100 characters. */
export const movementNameSchema = z.string().trim().min(1).max(movementNameMaxLength);

/** The key that makes Movement names unique per user, ignoring case and surrounding whitespace. */
export function movementNameKey(name: string): string {
  return name.trim().toLowerCase();
}
