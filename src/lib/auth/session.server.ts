import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import type { SessionCookies } from "./index";

const sessionCookieName = "session";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

/**
 * The session cookie of the current request, as the auth module's SessionCookies. Only call it
 * inside a server-function handler or middleware: it reads and writes the request in flight.
 */
export function requestSessionCookies(): SessionCookies {
  return {
    get: () => getCookie(sessionCookieName),
    set: (token, maxAgeSeconds) => setCookie(sessionCookieName, token, { ...cookieOptions, maxAge: maxAgeSeconds }),
    delete: () => deleteCookie(sessionCookieName, cookieOptions),
  };
}
