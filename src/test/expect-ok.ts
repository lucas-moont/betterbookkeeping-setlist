import type { ErrorCode, Result } from "@/lib/error-codes";

/** Narrows a module Result to its success branch, failing the test with the reason otherwise. */
export function expectOk<T extends object>(result: Result<T, ErrorCode>) {
  if (!result.ok) throw new Error(`Expected the operation to succeed, but it returned "${result.reason}"`);
  return result;
}
