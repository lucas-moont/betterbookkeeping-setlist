import { deleteCookie, getCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { sessionCookieOptions } from "./cookie-options";
import type { SessionCookies } from "./index";

const sessionCookieName = "session";

/**
 * The session cookie of the current request, as the auth module's SessionCookies. Only call it
 * inside a server-function handler or middleware: it reads and writes the request in flight.
 */
export function requestSessionCookies(): SessionCookies {
  const options = sessionCookieOptions(process.env.ENVIRONMENT);
  return {
    get: () => getCookie(sessionCookieName),
    set: (token, maxAgeSeconds) => setCookie(sessionCookieName, token, { ...options, maxAge: maxAgeSeconds }),
    delete: () => deleteCookie(sessionCookieName, options),
  };
}

/**
 * The IP the current request came from, for the sign-in attempt limit: the address of the
 * connection itself. A request whose address the server can't see shares one "unknown" bucket per
 * email.
 */
export function requestClientIp(): string {
  return getRequestIP() ?? "unknown";
}
