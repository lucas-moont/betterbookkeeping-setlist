# Sessions are stored in the database

The session cookie used to hold `userId.signature`, an HMAC of the user ID. The signature had no expiry inside it, so a copied token worked forever, and signing out only deleted the cookie from the browser. Sessions now live in a `Session` table. The cookie holds a random 32-byte token, and the table stores only its SHA-256 hash, so a copy of the database can't be used to sign in. A session lasts 15 days and slides: each visit pushes the expiry 15 days out, at most once a day so reads don't turn into a write per request (renew when `expiresAt - now < 14 days`, so no extra column is needed). Renewing writes the cookie again with the new max age; otherwise the browser would drop the cookie on day 15 while the row was still valid. Signing out deletes the row, which ends the session even if someone copied the cookie. Expired sessions are deleted when they're read, and at sign-in for that user; there is no scheduled cleanup.

`COOKIE_SECRET` was removed from `.env`, `AGENTS.md`, and the config check. With an opaque token nothing is signed anymore, and a variable that protects nothing would mislead whoever finds it. Don't reintroduce it unless something is actually signed again.

## Considered Options

- **Keep the signed cookie and put an expiry inside the signature.** About 30 minutes of work instead of 1.5–2 hours, and it ends "valid forever". But signing out still can't revoke a copied token, and the HMAC, the secret, and the constant-time comparison all stay.
- **Fixed 7-day sessions, as before.** A training log is opened a few times a week, so this makes regular users sign in again every week.

## Consequences

Reading the session takes two database queries instead of one: before, the server loaded the user by the ID in the cookie; now Prisma loads the Session by its token hash and then its user in a second query (`relationJoins` is not enabled). A renewal adds one write, at most once a day per Session. Everyone signed in when this ships has to sign in once more, because the cookie format changed, and there's no compatibility path on purpose (same reasoning as ADR 0005). "Sign out everywhere" and "end all sessions when the password changes" are one `deleteMany({ where: { userId } })` away, and are left out until there's a screen for them.
