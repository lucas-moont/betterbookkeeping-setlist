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

const daySeconds = 24 * 60 * 60;
const sessionLifetimeSeconds = 15 * daySeconds;
// Renewing only when less than this is left means at most one renewal a day, so reading the
// session doesn't turn into a write on every request, and no "last renewed" column is needed.
const renewWhenLeftMs = 14 * daySeconds * 1000;
// However often it is used, a Session ends this long after sign-in (its createdAt): sliding alone
// would keep a stolen cookie alive forever as long as someone kept using it.
const sessionMaxAgeMs = 90 * daySeconds * 1000;

// Only the hash is stored, so a copy of the Session table can't be used to sign in. The token is
// 32 random bytes, so a fast unsalted hash is enough: there's nothing to guess.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** When a Session signed in at `createdAt` would expire if extended now: 15 days out, or day 90 if sooner. */
function extendedExpiry(createdAt: Date, now: number): Date {
  return new Date(Math.min(now + sessionLifetimeSeconds * 1000, createdAt.getTime() + sessionMaxAgeMs));
}

/**
 * Gives a Session the lifetime it has left from now: `save` writes the new expiresAt, then the
 * cookie gets the same time as its max age. Starting and renewing both go through here, so the row
 * and the cookie can't expire on different days.
 */
async function extendSession(
  cookies: SessionCookies,
  token: string,
  expiresAt: Date,
  now: number,
  save: (expiresAt: Date) => Promise<unknown>,
) {
  await save(expiresAt);
  cookies.set(token, Math.floor((expiresAt.getTime() - now) / 1000));
}

/**
 * Starts a new Session for the user and puts its token in the cookie. A Session the browser already
 * had is ended first: signing in again, as anyone, must not leave it valid for a copy of the cookie.
 */
async function startSession(db: DbClient, cookies: SessionCookies, userId: string) {
  const previous = cookies.get();
  if (previous) await db.session.deleteMany({ where: { tokenHash: hashToken(previous) } });

  const token = randomBytes(32).toString("base64url");
  // createdAt and the first expiresAt come from one reading of the clock the module compares
  // against, so the 90-day cap starts exactly where the first 15 days do.
  const now = Date.now();
  const createdAt = new Date(now);
  await extendSession(cookies, token, extendedExpiry(createdAt, now), now, (expiresAt) =>
    db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt, createdAt } }),
  );
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

// Verified when no account matches, so an unknown email takes as long as a wrong password. The
// password is random and thrown away, so nothing ever verifies against it. Hashing costs ~50 ms,
// so it happens once per process, on the first sign-in that needs it.
let dummyPasswordHash: Promise<string> | undefined;

/**
 * Signs in with an email, in any case, and a password, starting a new Session: signing in on
 * another device keeps the first one. An unknown email and a wrong password both return
 * invalid-credentials after the same argon2 work, so neither the answer nor its timing says which
 * one was wrong. register's email-taken does tell that an account exists: a sign-up form has to.
 */
export const signIn = createServerOnlyFn(
  async (
    db: DbClient,
    cookies: SessionCookies,
    { email, password }: { email: string; password: string },
  ): Promise<Result<{ user: SessionUser }, "invalid-credentials">> => {
    const account = await db.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { ...sessionUserSelect, password: true },
    });
    if (!account) {
      await verifyPassword(await (dummyPasswordHash ??= hashPassword(randomBytes(32).toString("base64url"))), password);
      return { ok: false, reason: "invalid-credentials" };
    }
    if (!(await verifyPassword(account.password, password))) return { ok: false, reason: "invalid-credentials" };

    const { password: _password, ...user } = account;
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
 * original day 15 while the Session was still valid. Nothing slides past 90 days after sign-in:
 * then the Session expires however recently it was used.
 */
export const currentUser = createServerOnlyFn(
  async (db: DbClient, cookies: SessionCookies): Promise<SessionUser | null> => {
    const token = cookies.get();
    if (!token) return null;

    const session = await db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, expiresAt: true, createdAt: true, user: { select: sessionUserSelect } },
    });
    if (!session) return null;

    const now = Date.now();
    // The cap counts too, for a row renewed before it existed, whose expiresAt can be later.
    const endsAt = Math.min(session.expiresAt.getTime(), session.createdAt.getTime() + sessionMaxAgeMs);
    const msLeft = endsAt - now;
    // deleteMany and updateMany, not delete and update: a concurrent request may have removed the
    // row already (another read of this expired Session, or a sign-out), and that isn't an error.
    if (msLeft <= 0) {
      await db.session.deleteMany({ where: { id: session.id } });
      return null;
    }
    // Near the cap a renewal can't move the expiry anymore, and writing the same one again on every
    // read would make each request a write.
    const renewed = extendedExpiry(session.createdAt, now);
    if (msLeft < renewWhenLeftMs && renewed.getTime() > session.expiresAt.getTime()) {
      await extendSession(cookies, token, renewed, now, (expiresAt) =>
        db.session.updateMany({ where: { id: session.id }, data: { expiresAt } }),
      );
    }
    return session.user;
  },
);
