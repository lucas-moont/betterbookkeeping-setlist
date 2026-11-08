// One account per email address, whatever its case or the whitespace pasted around it. Pure, so
// the parity test can check it against the SQL of the migration that normalized the stored ones.

/** An email address as it is stored and looked up: trimmed and in lower case. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
