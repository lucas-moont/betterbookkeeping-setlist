import { z } from "zod";
import { emailSchema } from "./email";

// What the sign-in and create-account server functions accept. Pure, so the limits are tested
// without TanStack Start.

// argon2 hashes whatever it's given, so an unbounded password is unbounded server work per request.
const passwordMaxLength = 256;

export const signInInputSchema = z.object({ email: emailSchema, password: z.string().max(passwordMaxLength) });

export const createAccountInputSchema = z.object({
  email: emailSchema,
  name: z.string().min(1).max(100),
  password: z.string().min(6).max(passwordMaxLength),
});
