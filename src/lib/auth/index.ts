import crypto from "node:crypto";
import { createServerOnlyFn } from "@tanstack/react-start";
import type { DbClient } from "@/lib/db.server";
import type { Result } from "@/lib/error-codes";
import { hashPassword, verifyPassword } from "./password";

// The auth module (ADR 0010): accounts and the session behind the session cookie. It takes the
// cookie as a SessionCookies seam instead of reading the request, so the tests drive it with an
// in-memory cookie and session.server.ts is only the TanStack adapter. The password never leaves
// this module: every user it returns is a SessionUser.

/** The signed-in user as the rest of the app sees it. User.name is optional in the schema. */
export type SessionUser = { id: string; email: string; name: string | null };

/** The session cookie of the current request. */
export type SessionCookies = {
  get(): string | undefined;
  set(token: string, maxAgeSeconds: number): void;
  delete(): void;
};

const sessionUserSelect = { id: true, email: true, name: true } as const;

const sessionMaxAgeSeconds = 7 * 24 * 60 * 60;

// The token is still the user ID with an HMAC signature, as before this module existed. Read
// inside the functions so the development fallback never sits at the top of a module the client
// bundle imports.
function cookieSecret(): string {
  return process.env.COOKIE_SECRET || "dev-secret-change-in-production";
}

function signature(userId: string): string {
  return crypto.createHmac("sha256", cookieSecret()).update(userId).digest("hex");
}

function sessionToken(userId: string): string {
  return `${userId}.${signature(userId)}`;
}

function userIdFromToken(token: string): string | null {
  const [userId, given] = token.split(".");
  if (!userId || !given) return null;
  return given === signature(userId) ? userId : null;
}

function startSession(cookies: SessionCookies, userId: string) {
  cookies.set(sessionToken(userId), sessionMaxAgeSeconds);
}

/**
 * Creates an account and signs it in. An email that already has an account returns email-taken.
 * The input must already be valid (the adapter's zod schema).
 */
export const register = createServerOnlyFn(
  async (
    db: DbClient,
    cookies: SessionCookies,
    { email, name, password }: { email: string; name: string; password: string },
  ): Promise<Result<{ user: SessionUser }, "email-taken">> => {
    // INSERT ... ON CONFLICT DO NOTHING on the unique email: two concurrent sign-ups can't both get
    // in, and nothing throws. A caught P2002 would abort a transaction the caller passed in as db
    // (ADR 0006).
    const [user] = await db.user.createManyAndReturn({
      data: [{ email, name, password: await hashPassword(password) }],
      skipDuplicates: true,
      select: sessionUserSelect,
    });
    if (!user) return { ok: false, reason: "email-taken" };

    startSession(cookies, user.id);
    return { ok: true, user };
  },
);

/**
 * Signs in with an email and password. An unknown email and a wrong password both return
 * invalid-credentials, so sign-in never tells which emails have an account.
 */
export const signIn = createServerOnlyFn(
  async (
    db: DbClient,
    cookies: SessionCookies,
    { email, password }: { email: string; password: string },
  ): Promise<Result<{ user: SessionUser }, "invalid-credentials">> => {
    const row = await db.user.findUnique({ where: { email }, select: { ...sessionUserSelect, password: true } });
    if (!row || !(await verifyPassword(row.password, password))) return { ok: false, reason: "invalid-credentials" };

    const { password: _password, ...user } = row;
    startSession(cookies, user.id);
    return { ok: true, user };
  },
);

/** Signs out by deleting the session cookie. */
export const signOut = createServerOnlyFn(
  async (_db: DbClient, cookies: SessionCookies): Promise<Result<object, never>> => {
    cookies.delete();
    return { ok: true };
  },
);

/** The user the session cookie belongs to, or null when there is none or it isn't valid. */
export const currentUser = createServerOnlyFn(
  async (db: DbClient, cookies: SessionCookies): Promise<SessionUser | null> => {
    const token = cookies.get();
    const userId = token ? userIdFromToken(token) : null;
    if (!userId) return null;
    return db.user.findUnique({ where: { id: userId }, select: sessionUserSelect });
  },
);
