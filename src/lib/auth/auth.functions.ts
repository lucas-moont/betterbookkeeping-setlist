import { redirect } from "@tanstack/react-router";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { toServerResult } from "@/lib/error-codes";
import * as auth from "./index";
import { createAccountInputSchema, signInInputSchema } from "./inputs";
import { requestClientIp, requestSessionCookies } from "./session.server";

// Thin adapters over the auth module (ADR 0010): input validation, the module call with the
// request's session cookie, and toServerResult for the error codes. What they return reaches the
// browser, so it only ever holds a SessionUser, never the password.

async function readCurrentUser() {
  return auth.currentUser(await getServerSidePrismaClient(), requestSessionCookies());
}

/** The signed-in user, or null. The root route reads it on every navigation. */
export const getUserServerFn = createServerFn().handler(() => readCurrentUser());

export const signInServerFn = createServerFn({ method: "POST" })
  .inputValidator(signInInputSchema)
  .handler(async ({ data }) => {
    const db = await getServerSidePrismaClient();
    return toServerResult(await auth.signIn(db, requestSessionCookies(), { ...data, ip: requestClientIp() }));
  });

export const createAccountServerFn = createServerFn({ method: "POST" })
  .inputValidator(createAccountInputSchema)
  .handler(async ({ data }) => {
    return toServerResult(await auth.register(await getServerSidePrismaClient(), requestSessionCookies(), data));
  });

export const logoutServerFn = createServerFn({ method: "POST" }).handler(async () => {
  return toServerResult(await auth.signOut(await getServerSidePrismaClient(), requestSessionCookies()));
});

/**
 * Puts the signed-in user on context.user, and redirects to the sign-in page when there is none.
 * It reads the user itself: going through getUserServerFn would make a server function call
 * another one.
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await readCurrentUser();
  if (!user) {
    throw redirect({ to: "/sign-in" });
  }

  return next({
    context: { user },
  });
});
