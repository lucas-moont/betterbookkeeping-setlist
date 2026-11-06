# Movements are owned by a user

`Movement` had no owner: every user shared one library, and the movement server functions had no `authMiddleware`, so even a signed-out visitor could add to it. Body-weight is a property of a movement, so in a shared library one user flagging "Pull-up" would change every other user's sets and defaults. Every `Movement` now has a required `userId`, and every read and write is scoped to the signed-in user.

## Considered Options

- **Keep the library global and require sign-in.** Smallest change, but one user can still change data another user depends on.
- **Global catalogue plus personal movements.** Most flexible, but it needs override rules (whose body-weight flag wins?) that this milestone doesn't need.

## Consequences

The migration can't just add a column, because existing movements have no owner to give them. It copies each movement to every user who has sets with it, re-points those users' sets to their copy, and drops movements nobody used. No history is lost.

Names are unique per user, ignoring case, so that "bench press" and "Bench Press" can't split one movement's Progression Chart in two. The code stores a derived `nameKey` (`name` trimmed and lower-cased) and Prisma enforces `@@unique([userId, nameKey])`. Before adding the constraint, the migration merges case-duplicates within each user: the movement with the most sets survives, and the other's sets are moved onto it.

We rejected a hand-written `UNIQUE ("userId", lower("name"))` index, because Prisma would try to drop it in every generated migration (see ADR 0006), and Postgres `citext`, because it adds an extension for a single column. The cost of `nameKey` is a derived column that every write to `name` has to keep in sync.

The migration computes `nameKey` in SQL for the existing rows, so its definition must match `movementNameKey()` exactly. Postgres's `trim()` and the regexp `\s` strip a different set of characters than JavaScript's `trim()`, and `lower()` follows the database's libc collation rather than Unicode's rules, so the migration spells out JavaScript's whitespace characters and lower-cases with the ICU collation. A test runs the migration's SQL functions against the code.
