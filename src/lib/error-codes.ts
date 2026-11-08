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
  "too-many-attempts": (minutes: number) =>
    `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  // workouts
  "empty-workout": "This workout has no completed sets",
  "workout-not-empty": "This workout has completed sets, so it can't be discarded",
} as const;

export type ErrorCode = keyof typeof errorMessages;

/**
 * The data a failure carries besides its code, for the codes whose message is built from it. A
 * code missing here carries nothing, and its message is fixed text.
 */
export type ErrorDetails = {
  "too-many-attempts": { retryAfterMinutes: number };
};

type DetailsOf<E extends ErrorCode> = E extends keyof ErrorDetails ? ErrorDetails[E] : unknown;

/** One failure per code (the conditional distributes over E), each with its own details. */
type Failure<E extends ErrorCode> = E extends ErrorCode ? { ok: false; reason: E } & DetailsOf<E> : never;

type ServerFailure<E extends ErrorCode> = E extends ErrorCode
  ? { success: false; code: E; error: string } & DetailsOf<E>
  : never;

/** What a domain module returns from an operation that can fail: the data, or the reason it didn't happen. */
export type Result<T extends object, E extends ErrorCode> = ({ ok: true } & T) | Failure<E>;

/**
 * What a server function sends to the browser. `code` is stable, so the client can branch on it,
 * and a failure's details come along beside it.
 */
export type ServerResult<T extends object, E extends ErrorCode> = ({ success: true } & T) | ServerFailure<E>;

function messageOf(failure: Failure<ErrorCode>): string {
  return failure.reason === "too-many-attempts"
    ? errorMessages[failure.reason](failure.retryAfterMinutes)
    : errorMessages[failure.reason];
}

/** Translates a module Result into the `{ success, ... }` shape every server function returns. */
export function toServerResult<T extends object, E extends ErrorCode>(result: Result<T, E>): ServerResult<T, E> {
  if (!result.ok) {
    const failure = result as Failure<ErrorCode>;
    const { ok: _ok, reason, ...details } = failure;
    return { success: false, code: reason, error: messageOf(failure), ...details } as ServerResult<T, E>;
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
