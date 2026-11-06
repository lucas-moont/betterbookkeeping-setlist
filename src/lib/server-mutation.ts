import { mutationOptions, type QueryKey } from "@tanstack/react-query";
import { type ErrorCode, type ServerResult, ServerResultError, unwrap } from "@/lib/error-codes";

/**
 * mutationOptions for a server function that answers with toServerResult (ADR 0010). Every mutation
 * is built here, so none can forget the two rules:
 * - A `{ success: false }` is thrown as a ServerResultError (unwrap). TanStack Query then runs the
 *   error toast in src/router.tsx and skips the invalidation, which only a success should trigger.
 * - `invalidates` lists the key prefixes a success makes stale. `formErrors` lists the codes the
 *   screen shows next to a field instead of in a toast.
 */
export function serverMutationOptions<TVariables = void, T extends object = object, E extends ErrorCode = never>(options: {
  mutationFn: (variables: TVariables) => Promise<ServerResult<T, E>>;
  invalidates: readonly QueryKey[];
  formErrors?: readonly E[];
}) {
  return mutationOptions({
    mutationFn: async (variables: TVariables) => unwrap(await options.mutationFn(variables)),
    meta: { invalidates: options.invalidates, formErrors: options.formErrors },
  });
}

/** Whether the page's form shows this error itself, so the global toast leaves it alone. */
export function isFormError(error: unknown, meta: { formErrors?: readonly ErrorCode[] } | undefined): boolean {
  return error instanceof ServerResultError && (meta?.formErrors?.includes(error.code) ?? false);
}

/**
 * What the error toast says. An error code has a message written for the user. Anything else (a
 * database or validation error, the network) can carry internal details such as table and column
 * names, so it gets a generic message, and the details go to the console only.
 */
export function errorToastMessage(error: unknown): string {
  if (error instanceof ServerResultError) return error.message;
  console.error(error);
  return "Something went wrong. Please try again.";
}
