import { deleteCookie, getCookie, getRequestHeader, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { clientIp } from "./client-ip";
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
 * The IP the current request came from, for the sign-in attempt limit (see clientIp). Reads
 * x-forwarded-for only when TRUST_PROXY is exactly "true".
 */
export function requestClientIp(): string {
  return clientIp({
    connectionIp: getRequestIP(),
    forwardedFor: getRequestHeader("x-forwarded-for"),
    trustProxy: process.env.TRUST_PROXY === "true",
  });
}
