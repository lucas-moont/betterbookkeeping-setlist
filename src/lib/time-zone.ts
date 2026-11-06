import { useEffect } from "react";
import { rootRouteId, useRouteContext, useRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

// The user's time zone (ADR 0004). The server can't know it, so the browser stores its IANA zone in
// a cookie, and both the server render and the browser read that same cookie. Reading the same value
// on both sides is what keeps their dates equal, so nothing here asks the browser directly except
// the hook that writes the cookie.

const cookieName = "tz";

/** What every date uses until the browser has stored its zone, for example on a first visit. */
const fallbackTimeZone = "UTC";

// The longest IANA name is about 30 characters. The cap keeps an oversized cookie out of Intl.
const maxTimeZoneLength = 64;

/**
 * Whether the zone is a name Intl knows. Checked by trying it, because
 * Intl.supportedValuesOf("timeZone") leaves out valid names such as "UTC" and "Asia/Kolkata"
 * (ADR 0004). Offsets such as "+05:30" are refused even though Intl takes them: Postgres reads them
 * in AT TIME ZONE with the sign flipped.
 */
export function isValidTimeZone(zone: string): boolean {
  if (zone.length === 0 || zone.length > maxTimeZoneLength || /^[+-]/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The zone in a raw cookie value, or UTC when it is missing or not a zone. Never throws. */
export function timeZoneFromCookie(value: string | undefined): string {
  if (!value) return fallbackTimeZone;
  try {
    const zone = decodeURIComponent(value);
    return isValidTimeZone(zone) ? zone : fallbackTimeZone;
  } catch {
    // Broken percent-encoding.
    return fallbackTimeZone;
  }
}

const readCookie = createIsomorphicFn()
  .server(() => getCookie(cookieName))
  .client(() =>
    document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1),
  );

/** The user's time zone, read from the cookie on the server render and in the browser alike. */
export function readTimeZone(): string {
  return timeZoneFromCookie(readCookie());
}

/** The user's time zone, as the root route read it. Pass it to formatDate. */
export function useTimeZone(): string {
  return useRouteContext({ from: rootRouteId, select: (context) => context.timeZone });
}

/**
 * Stores the browser's zone in the cookie when it is missing or out of date (a first visit, or the
 * user travelled), then reloads the route data so the page on screen re-renders in that zone.
 */
export function useSyncTimeZoneCookie() {
  const router = useRouter();
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!isValidTimeZone(zone) || readTimeZone() === zone) return;

    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${cookieName}=${encodeURIComponent(zone)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    // Only when the cookie took: with cookies blocked, the page would come back in UTC anyway.
    if (readTimeZone() === zone) void router.invalidate();
  }, [router]);
}
