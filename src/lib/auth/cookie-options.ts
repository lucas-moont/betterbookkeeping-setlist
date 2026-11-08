// The session cookie's attributes, pure so the tests can check them without the TanStack request
// helpers that session.server.ts needs.

/**
 * Secure unless ENVIRONMENT says development or test, which run on plain http. It fails safe: a
 * deploy that forgets ENVIRONMENT, or misspells it, still sends the cookie over https only.
 * httpOnly keeps it from page scripts; SameSite=Lax keeps it off cross-site POSTs.
 */
export function sessionCookieOptions(environment: string | undefined) {
  return {
    httpOnly: true,
    secure: environment !== "development" && environment !== "test",
    sameSite: "lax",
    path: "/",
  } as const;
}
