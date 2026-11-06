// Every error a domain module can return, with the message the user sees, in one place.
// Pure and free of server code, so it is also where translations would plug in later.

export const errorMessages = {
  "no-current-workout": "There is no Current Workout",
  "set-not-found": "Set not found",
} as const;

export type ErrorCode = keyof typeof errorMessages;

/** What a domain module returns from an operation that can fail: the data, or the reason it didn't happen. */
export type Result<T extends object, E extends ErrorCode> = ({ ok: true } & T) | { ok: false; reason: E };

/** What a server function sends to the browser. `code` is stable, so the client can branch on it. */
export type ServerResult<T extends object, E extends ErrorCode> =
  | ({ success: true } & T)
  | { success: false; code: E; error: string };

/** Translates a module Result into the `{ success, ... }` shape every server function returns. */
export function toServerResult<T extends object, E extends ErrorCode>(result: Result<T, E>): ServerResult<T, E> {
  if (!result.ok) {
    return { success: false, code: result.reason, error: errorMessages[result.reason] };
  }
  const { ok: _ok, ...data } = result;
  return { success: true, ...(data as T) };
}
