import { createHash, randomBytes } from "node:crypto";
import { createServerOnlyFn } from "@tanstack/react-start";
import type { DbClient } from "@/lib/db.server";
import type { Result } from "@/lib/error-codes";
import { normalizeEmail } from "./email";
import { hashPassword, verifyPassword } from "./password";

// The auth module (ADR 0010): accounts and the Sessions behind the session cookie (ADR 0009). It
// takes the cookie as a SessionCookies seam instead of reading the request, so the tests drive it
// with an in-memory cookie and session.server.ts is only the TanStack adapter. The password never
// leaves this module: every user it returns is a SessionUser.

/** The signed-in user as the rest of the app sees it. User.name is optional in the schema. */
export type SessionUser = { id: string; email: string; name: string | null };

/** The session cookie of the current request. */
export type SessionCookies = {
  get(): string | undefined;
  set(token: string, maxAgeSeconds: number): void;
  delete(): void;
};

const sessionUserSelect = { id: true, email: true, name: true } as const;

const dayMs = 24 * 60 * 60 * 1000;
const sessionLifetimeMs = 15 * dayMs;
// Renewing only when less than this is left means at most one renewal a day, so reading the
// session doesn't turn into a write on every request, and no "last renewed" column is needed.
const renewWhenLeftMs = 14 * dayMs;

// Only the hash is stored, so a copy of the Session table can't be used to sign in. The token is
// 32 random bytes, so a fast unsalted hash is enough: there's nothing to guess.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Starts a new Session for the user and puts its token in the cookie. */
async function startSession(db: DbClient, cookies: SessionCookies, userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + sessionLifetimeMs) },
  });
  cookies.set(token, sessionLifetimeMs / 1000);
}

/**
 * Creates an account and signs it in. An email that already has an account, ignoring case and the
 * whitespace around it, returns email-taken. The input must already be valid (the adapter's zod
 * schema).
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
      data: [{ email: normalizeEmail(email), name, password: await hashPassword(password) }],
      skipDuplicates: true,
      select: sessionUserSelect,
    });
    if (!user) return { ok: false, reason: "email-taken" };

    await startSession(db, cookies, user.id);
    return { ok: true, user };
  },
);

/**
 * Signs in with an email, in any case, and a password, starting a new Session: signing in on
 * another device keeps the first one. An unknown email and a wrong password both return
 * invalid-credentials, so sign-in never tells which emails have an account.
 */
export const signIn = createServerOnlyFn(
  async (
    db: DbClient,
    cookies: SessionCookies,
    { email, password }: { email: string; password: string },
  ): Promise<Result<{ user: SessionUser }, "invalid-credentials">> => {
    const row = await db.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { ...sessionUserSelect, password: true },
    });
    if (!row || !(await verifyPassword(row.password, password))) return { ok: false, reason: "invalid-credentials" };

    const { password: _password, ...user } = row;
    // There is no scheduled cleanup (ADR 0009): a Session nobody reads again is deleted here.
    await db.session.deleteMany({ where: { userId: user.id, expiresAt: { lte: new Date() } } });
    await startSession(db, cookies, user.id);
    return { ok: true, user };
  },
);

/** Ends the Session the cookie holds, so a copy of the cookie stops working too, then deletes the cookie. */
export const signOut = createServerOnlyFn(
  async (db: DbClient, cookies: SessionCookies): Promise<Result<object, never>> => {
    const token = cookies.get();
    if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    cookies.delete();
    return { ok: true };
  },
);

/**
 * The user whose Session the cookie holds, or null when there is none or it expired. An expired
 * Session is deleted here. A Session with less than 14 of its 15 days left slides to 15 days from
 * now, and the cookie is written again with the new max age, or the browser would drop it on the
 * original day 15 while the Session was still valid.
 */
export const currentUser = createServerOnlyFn(
  async (db: DbClient, cookies: SessionCookies): Promise<SessionUser | null> => {
    const token = cookies.get();
    if (!token) return null;

    const session = await db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, expiresAt: true, user: { select: sessionUserSelect } },
    });
    if (!session) return null;

    const now = Date.now();
    const left = session.expiresAt.getTime() - now;
    // deleteMany and updateMany, not delete and update: a concurrent request may have removed the
    // row already (another read of this expired Session, or a sign-out), and that isn't an error.
    if (left <= 0) {
      await db.session.deleteMany({ where: { id: session.id } });
      return null;
    }
    if (left < renewWhenLeftMs) {
      await db.session.updateMany({ where: { id: session.id }, data: { expiresAt: new Date(now + sessionLifetimeMs) } });
      cookies.set(token, sessionLifetimeMs / 1000);
    }
    return session.user;
  },
);
