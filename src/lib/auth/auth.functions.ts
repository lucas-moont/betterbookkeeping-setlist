import { redirect } from "@tanstack/react-router";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { toServerResult } from "@/lib/error-codes";
import * as auth from "./index";
import { requestSessionCookies } from "./session.server";

// Thin adapters over the auth module (ADR 0010): input validation, the module call with the
// request's session cookie, and toServerResult for the error codes. What they return reaches the
// browser, so it only ever holds a SessionUser, never the password.

/** The signed-in user, or null. The root route reads it on every navigation. */
export const getUserServerFn = createServerFn().handler(async () => {
  return auth.currentUser(await getServerSidePrismaClient(), requestSessionCookies());
});

export const signInServerFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.email(), password: z.string() }))
  .handler(async ({ data }: { data: { email: string; password: string } }) => {
    return toServerResult(await auth.signIn(await getServerSidePrismaClient(), requestSessionCookies(), data));
  });

export const createAccountServerFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.email(), name: z.string().min(1), password: z.string().min(6) }))
  .handler(async ({ data }: { data: { email: string; name: string; password: string } }) => {
    return toServerResult(await auth.register(await getServerSidePrismaClient(), requestSessionCookies(), data));
  });

export const logoutServerFn = createServerFn({ method: "POST" }).handler(async () => {
  return toServerResult(await auth.signOut(await getServerSidePrismaClient(), requestSessionCookies()));
});

/**
 * Puts the signed-in user on context.user, and redirects to the sign-in page when there is none.
 * It calls the module directly: going through getUserServerFn would make a server function call
 * another one.
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await auth.currentUser(await getServerSidePrismaClient(), requestSessionCookies());
  if (!user) {
    throw redirect({ to: "/sign-in" });
  }

  return next({
    context: { user },
  });
});
