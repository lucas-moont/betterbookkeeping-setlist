import { z } from "zod";

// One account per email address, whatever its case or the whitespace pasted around it. Free of
// server code, so the server functions' inputValidator and the module share one definition, and
// the parity test can check normalizeEmail against the SQL of the migration that normalized the
// stored addresses.

/**
 * An email address as the user types it, trimmed before the format check, which would refuse the
 * whitespace a paste leaves around an address. Case is left as typed: normalizeEmail handles it.
 * At most 254 characters, the longest address SMTP allows: a longer emailKey could exceed what one
 * btree index row holds, and that insert would fail only after argon2 had run.
 */
export const emailSchema = z.string().trim().max(254).pipe(z.email());

/** An email address as it is stored and looked up: trimmed and in lower case. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
