import { deleteCookie, getCookie, getRequestHeader, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { clientIp, deployWarnings } from "./client-ip";
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

// Warnings already printed by this process: a misconfiguration repeats on every request.
const warned = new Set<string>();

/**
 * The IP the current request came from, for the sign-in attempt limit (see clientIp). Reads
 * x-forwarded-for only when TRUST_PROXY is exactly "true", and warns once in the server log when
 * the deploy looks misconfigured (see deployWarnings).
 */
export function requestClientIp(): string {
  const forwardedFor = getRequestHeader("x-forwarded-for");
  const trustProxy = process.env.TRUST_PROXY === "true";
  const ip = clientIp({ connectionIp: getRequestIP(), forwardedFor, trustProxy });
  for (const warning of deployWarnings({ forwardedFor, trustProxy, ip })) {
    if (warned.has(warning)) continue;
    warned.add(warning);
    console.warn(warning);
  }
  return ip;
}
