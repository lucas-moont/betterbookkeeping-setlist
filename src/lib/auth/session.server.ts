import crypto from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const sessionCookieName = "session";

// In production, use a proper secret from environment variables
const COOKIE_SECRET = process.env.COOKIE_SECRET || "dev-secret-change-in-production";

/**
 * Signs a user ID to create a tamper-proof session token
 */
function signUserId(userId: string): string {
  const signature = crypto.createHmac("sha256", COOKIE_SECRET).update(userId).digest("hex");
  return `${userId}.${signature}`;
}

/**
 * Verifies a signed session token and returns the user ID if valid
 */
function verifySessionToken(token: string): string | null {
  const [userId, signature] = token.split(".");
  if (!userId || !signature) return null;

  const expectedSignature = crypto.createHmac("sha256", COOKIE_SECRET).update(userId).digest("hex");
  if (signature !== expectedSignature) return null;

  return userId;
}

/**
 * Sets the session cookie for a user
 */
export function setSessionCookie(userId: string) {
  const token = signUserId(userId);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  setCookie(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
  });
}

/**
 * Reads the session cookie and returns the signed-in user ID, or null
 */
export function readSessionUserId(): string | null {
  const sessionToken = getCookie(sessionCookieName);
  if (!sessionToken) return null;
  return verifySessionToken(sessionToken);
}

export function clearSessionCookie() {
  deleteCookie(sessionCookieName);
}
