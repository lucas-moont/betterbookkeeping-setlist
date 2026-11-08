// Every error a domain module can return, with the message the user sees, in one place.
// Pure and free of server code, so it is also where translations would plug in later.

export const errorMessages = {
  "no-current-workout": "There is no Current Workout",
  "set-not-found": "Set not found",
  "movement-name-taken": "You already have a movement with this name",
  "movement-not-found": "Movement not found",
  "body-weight-date-in-future": "The date can't be in the future",
  "body-weight-entry-not-found": "Body weight entry not found",
  "body-weight-required": "Enter your body weight above 0",
  "added-weight-not-allowed": "Only body-weight movements take an added weight",
  "assistance-exceeds-body-weight": "Assistance can't be more than your body weight",
  "invalid-time-zone": "Your device's time zone isn't supported",
  // auth
  "invalid-credentials": "Invalid email or password",
  "email-taken": "An account with this email already exists",
  "too-many-attempts": ({ retryAfterMinutes: minutes }: { retryAfterMinutes: number }) =>
    `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  // workouts
  "empty-workout": "This workout has no completed sets",
  "workout-not-empty": "This workout has completed sets, so it can't be discarded",
} as const;

export type ErrorCode = keyof typeof errorMessages;

// A code whose message is a function carries that function's argument as its details, so the two
// are one definition and can't drift. A code with fixed text carries nothing.
type DetailsOf<E extends ErrorCode> = (typeof errorMessages)[E] extends (details: infer D) => string ? D : unknown;

/** A module's failure for one code (the conditional distributes over a union of codes), with its details. */
export type Failure<E extends ErrorCode> = E extends ErrorCode ? { ok: false; reason: E } & DetailsOf<E> : never;

/** What a domain module returns from an operation that can fail: the data, or the reason it didn't happen. */
export type Result<T extends object, E extends ErrorCode> = ({ ok: true } & T) | Failure<E>;

/**
 * What a server function sends to the browser. `code` is stable, so the client can branch on it.
 * A failure's details only go into `error`, never beside it.
 */
export type ServerResult<T extends object, E extends ErrorCode> =
  | ({ success: true } & T)
  | { success: false; code: E; error: string };

function messageOf(failure: Failure<ErrorCode>): string {
  const message = errorMessages[failure.reason];
  // TypeScript can't tie a code's message to that same code's failure, but DetailsOf makes the
  // failure carry exactly what the message function takes.
  return typeof message === "function" ? (message as (details: Failure<ErrorCode>) => string)(failure) : message;
}

/** Translates a module Result into the `{ success, ... }` shape every server function returns. */
export function toServerResult<T extends object, E extends ErrorCode>(result: Result<T, E>): ServerResult<T, E> {
  if (!result.ok) {
    // Failure<E> is a conditional type, so TypeScript only sees its reason as some ErrorCode.
    return { success: false, code: result.reason as E, error: messageOf(result) };
  }
  const { ok: _ok, ...data } = result;
  return { success: true, ...(data as T) };
}

/** A server function's `{ success: false }`, thrown on the client so TanStack Query treats it as an error. */
export class ServerResultError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServerResultError";
  }
}

/**
 * Hands a success back as it is and throws a failure as a ServerResultError. Mutations call it in
 * their mutationFn, so a failure runs onError (the toast, or a form's own message) and never the
 * cache invalidation that only a success should trigger.
 */
export function unwrap<T extends object, E extends ErrorCode>(result: ServerResult<T, E>): { success: true } & T {
  if (!result.success) throw new ServerResultError(result.code, result.error);
  return result;
}
