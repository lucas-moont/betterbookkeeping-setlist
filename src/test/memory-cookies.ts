import type { SessionCookies } from "@/lib/auth";

export type MemoryCookies = SessionCookies & {
  /** Every `set`, in order. */
  readonly sets: { token: string; maxAgeSeconds: number }[];
  /** How many times `delete` ran. */
  readonly deletes: number;
};

/**
 * An in-memory session cookie for tests: `set` and `delete` change what `get` returns, the way a
 * browser would on its next request, and every call is recorded so a test can check what the auth
 * module wrote and with which max age. Pass a token to start with a cookie someone already has.
 */
export function memoryCookies(initial?: string): MemoryCookies {
  let value = initial;
  const sets: { token: string; maxAgeSeconds: number }[] = [];
  let deletes = 0;

  return {
    get: () => value,
    set(token: string, maxAgeSeconds: number) {
      value = token;
      sets.push({ token, maxAgeSeconds });
    },
    delete() {
      value = undefined;
      deletes += 1;
    },
    sets,
    get deletes() {
      return deletes;
    },
  };
}
