# Failed sign-ins are limited per email and IP

Sign-in had no limit, so a script could try passwords against one account as fast as argon2 answered. Now a sign-in is refused, even with the right password, once its email and IP have 5 Failed Sign-ins in the last 15 minutes, and the answer says in how many minutes it opens again. The limit lives in Postgres, in a `FailedSignIn` table (`emailKey`, `ip`, `createdAt`): memory would be wiped by every restart and split across instances. Only failures are stored, for emails with and without an account alike, so the limit says nothing about which emails exist. A refused sign-in is not stored: otherwise someone who kept trying would never get back in. A successful sign-in deletes its bucket.

A refused sign-in costs one read and no argon2, which is the path a flood of attempts takes. Below the limit, the failure is stored before the password is checked and then the bucket is counted with it; past 5, the request deletes its own row and is refused. Counting first and storing after argon2 let every request of a parallel burst read "fewer than 5" and get its password checked (in one test run, 20 parallel requests got 9). Storing first, each request sees at least the rows of every request that counted before it, so at most 5 passwords get checked per window. A success deletes the row with the rest of its bucket.

Failures that left the window are deleted lazily and globally: every sign-in that stores a row first deletes all rows older than 15 minutes, of every email. Scoped to one email, the rows of every one-off email of a credential-stuffing run would stay forever; Sessions can be cleaned per user only because they are also deleted when read (ADR 0009). The delete runs on the storing path only, not on refused sign-ins, and an index on `createdAt` makes it a range delete next to the `(emailKey, ip, createdAt)` index the count uses. Its cost in the tests: a sign-in deletes other test files' failures by its own clock, so every test that relies on stored failures lives in `src/lib/auth/sign-in-limit.test.ts`, which runs its clock in 2100.

The IP is the connection's address. Behind a reverse proxy that is the proxy's, so `TRUST_PROXY=true` makes the limit read the right-most entry of `X-Forwarded-For`: the one address the proxy appended. Everything to its left is whatever the client sent. This assumes exactly one appending proxy, and an origin reachable only through it: a request that reaches the app directly could write that header itself. An IPv6 address counts as its /64, since one machine usually gets a whole /64, and an IPv4-mapped IPv6 address as its IPv4 address. The server logs a warning once when requests carry `X-Forwarded-For` while `TRUST_PROXY` is off, and once when a request has no address, because both turn the limit into one bucket per email for everyone.

## Considered Options

- **An in-memory limiter.** No table and no queries, but a restart forgets every count, and two instances count separately.
- **A cap per IP across all emails.** It would slow one address trying many emails. In local Docker every request arrives from the gateway's address, so it would lock out everyone at once, and behind NAT it would lock out a whole office.
- **A Postgres advisory lock per bucket around the count and the check.** It is exact, but it serializes a bucket's sign-ins for the whole ~50 ms of argon2 and needs a transaction around it. Storing first gets the same bound without a lock.
- **A CAPTCHA after some failures.** It stops scripts better, but it needs a third-party service and a screen change, and a training log has no reason to collect that much from its users.

## Consequences

Known limits:

- Credential stuffing, one guess each against many emails from many IPs, is not slowed down. Each email and IP pair gets its own 5.
- People behind one IP share each email's bucket. From the same office or carrier NAT, or anywhere when every request arrives with one address (a proxy without `TRUST_PROXY`, or the "unknown" bucket), anyone who knows an email can lock its owner out for 15 minutes with 5 wrong passwords. From another network, the attacker only fills their own bucket.
- CSRF on sign-in is covered by server functions being POST and by the `SameSite=Lax` session cookie, not by this limit.
