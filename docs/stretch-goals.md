# Stretch goals

The README lists four stretch goals. This file answers each one. Each section says what was **implemented**, with the ADR or pull request behind it, and what was **only designed**, with the reasons. Terms such as Load, Training Day and Gym Visit are defined in `CONTEXT.md`.

| Stretch goal               | Implemented                                                                                                   | Only designed                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Nutrition                  | Nothing yet. The body weight it builds on is in place.                                                        | The model, the rules and the screen     |
| Data model and performance | Owned movements, decimal weights, foreign-key indexes, one Current Workout, history pages, progression in SQL | The admin board                         |
| Security                   | argon2id, no server secrets in the browser, sessions in the database, a limit on failed sign-ins              | Sign out everywhere, email verification |
| UI polish                  | A design system, the screens built from approved prototypes, the empty-workout dialog, the phone layout       | Touch sizes inside the UI primitives    |

## Nutrition

**Only designed.** Nothing here is in the code. It reuses what the app already has: the Body Weight Entries, the user's time zone (ADR 0004), the domain folders (ADR 0010) and `TimeChart`.

**What the user gets.** A Nutrition section on the Profile, next to Body Weight. The user logs what they ate on a day, with calories and the three macros, and sets a daily calorie goal. A chart shows calories per day against the goal, and a line says the estimated surplus or deficit. With two sections, the Profile then needs its own sidebar (see "Body weight on the Profile" in the README).

**The model.**

- **`FoodEntry`**: `userId`, `date`, `name`, `calories`, `proteinG`, `carbsG`, `fatG`, `createdAt`. Many per day. `date` is a calendar day in the user's time zone, sent as `"YYYY-MM-DD"` like a Body Weight Entry, so a late dinner in São Paulo counts on the day it was eaten (ADR 0004). Grams are `Decimal(6,1)` and calories an integer. An index on `(userId, date)` serves the day totals, and `src/test/foreign-key-indexes.test.ts` would fail without an index that starts with `userId`.
- **Calories are stored, not derived.** Protein and carbs give about 4 kcal per gram and fat about 9, but alcohol and fibre break that sum, and food labels round. So the user's number is kept. When it is far from the 4/4/9 sum, the form says so, and saves it anyway.
- **`NutritionGoal`**: `userId`, `calories`, optional macro targets, `effectiveFrom` (a date). A new goal adds a row instead of changing the old one, so a day in March is compared with the goal of March. It is the same idea as the Body Weight Snapshot (ADR 0003): changing today's value never rewrites the past.
- **Day totals in SQL.** One query returns each day with its sums, grouped by `date`, like the Progression Chart query (ADR 0004). The browser never adds up raw entries.

**Surplus or deficit, two ways.**

1. **Against the goal.** The day's calories minus the goal in force that day. This is exact, but it only says whether the user followed their plan.
2. **From the body weight trend.** This says whether the plan works. Smooth the Body Weight Entries over two to four weeks, because one day's weight moves with water and food by a pound or more. With the rule of thumb of about 3,500 kcal per pound, the daily surplus is the trend's change per week × 3,500 ÷ 7, and the estimated maintenance is the average logged intake minus that surplus. Days with no food logged are left out of the average, not counted as zero. The rule of thumb overestimates long-term change, and the estimate needs weeks of consistent logging. So the screen labels it as an estimate, shows it only after enough days with both a weight and logged food, and never uses it to set the goal on its own.

**Left out, and why.**

- **A food database and barcode scanning.** Searching foods needs an external source (such as USDA FoodData Central or Open Food Facts) and a sync job. That is a product of its own, and the model above works with typed numbers.
- **Portions, servings and recipes.** Without a food database there is nothing to multiply.
- **Micronutrients.** The goal asks about macros and calories.

## Data model and performance

**What was wrong, and what changed.** Each row is implemented. The README sections under "Changes to the starter code" have the details and the tests.

| What was wrong                                                                                                                                                       | What changed                                                                                                                                                                                                                                                                                    | Where              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Every user shared one movement library, and a signed-out visitor could add to it. A body-weight flag on a shared "Pull-up" would change everyone's sets.             | Each movement has an owner, with a unique name per user that ignores case. A hand-written migration gave each user their own copies and kept every set.                                                                                                                                         | ADR 0001, #18      |
| `Set.weight` was an `Int`, so 135.5 lb couldn't be logged, and the form cut decimals off with `parseInt`.                                                            | Every weight is `Decimal(6,2)` in pounds. Validation refuses a third decimal instead of rounding.                                                                                                                                                                                               | ADR 0002, #20      |
| A Load computed in JavaScript is a float: `150.1 + 2.2` is `152.29999999999998`. Postgres `numeric` is exact.                                                        | `load()` in `src/lib/weight.ts` is the only Load formula, and rounds to two decimals. The progression query has the same formula in SQL, and a test checks that both give the same number.                                                                                                      | ADR 0002, #16, #32 |
| No foreign key had an index, so every read by user or by workout read the whole table.                                                                               | Indexes on `Set(workoutId)`, `Set(movementId)`, `Workout(userId, completedAt)` and `Session(userId)`. An `EXPLAIN` on about 2 million sets shows a scan of the whole table before and an index after, for every query on `Set` and `Workout`. A test fails when a new foreign key has no index. | #18, #27, #29, #34 |
| A user could have several Current Workouts (a double click on Start), and the app picked one by sorting random UUIDs.                                                | A partial unique index allows one per user, and `start` returns the one that is open. It wins the Current Workout lookup; `Workout(userId, completedAt)` serves the history, which the partial index can't.                                                                                     | ADR 0006, #27      |
| Workouts had no start time, and sets no order of their own.                                                                                                          | `Workout.startedAt`, which stays empty for old workouts instead of being guessed, and `Set.createdAt`, then `id`, for the order.                                                                                                                                                                | ADR 0007, #24, #27 |
| The starter code had no body weight. One column on `User` would keep only the last value, and a default the user can overwrite would move old charts.                | `BodyWeightEntry` keeps one row per day. A body-weight set copies the weight when it is logged (the Body Weight Snapshot), so a later entry never changes it.                                                                                                                                   | ADR 0003, #26, #31 |
| The history read every Completed Workout with every Set and Movement on each visit: about 200 workouts and 4,000 sets a year for someone training four times a week. | 20 workouts per page, by a `(completedAt, id)` cursor, with Load more. A cursor stays right when a workout is deleted while paging, and an offset doesn't.                                                                                                                                      | #36                |
| A progression chart computed in the browser would download every set of a movement.                                                                                  | One query per movement returns one row per Training Day with the three metrics, grouped in Postgres in the user's time zone.                                                                                                                                                                    | ADR 0004, #32      |

**An open finding, made smaller.** The `EXPLAIN` of #29 found that the history loads its movements with one id per set: 1,000 ids for 50 movements, and Postgres reads the whole `Movement` table to return them. Pages (#36) cap that at the sets of 21 workouts (a page reads one extra to know whether another exists), so it no longer grows with the history. It is not gone: loading the movements once per page, by distinct id, would remove it.

### The admin board

**Only designed.** The README asks for "an admin board that summarizes the users in the system". A summary of every user, computed when the page opens, reads every workout and every set in the database. The `EXPLAIN` of #29 read the whole `Set` table of 2 million rows in about 110 to 150 ms, and that grows with every set anyone logs.

**Step zero: an admin.** There is no role today. `User.role` would be an enum, `USER` by default, with `ADMIN` granted by a script and never from a screen. An `adminMiddleware` would run after `authMiddleware` on every admin server function. The admin route would hide from other users, but the server check is the one that counts. The board shows counts and dates, never a user's body weight or sets.

**What the board shows.** Totals (users, active users in the last 7 and 30 days, workouts and sets per week), a chart of sign-ups and workouts per week, and a table of users: email, signed up, last sign-in, last workout, Completed Workouts, Gym Visits and Completed Sets, sorted by last workout.

**The model: a summary kept up to date by each event.**

- **`UserSummary`**, one row per user: `workoutsCompleted`, `gymVisits`, `setsCompleted`, `lastWorkoutAt`, `lastSignInAt`. An index on `(lastWorkoutAt, userId)` sorts the table. The board pages through it with a cursor, the same way the history does (#36), so a page reads 50 rows whatever the number of users. Active users are those who completed a workout in the window: a count of `UserSummary` rows by `lastWorkoutAt`, through the same index.
- **Each write that changes a number updates the row, in the same transaction.** `register` creates the row; `signIn` sets `lastSignInAt`; `complete` adds the workout and its Completed Sets, or a Gym Visit; `deleteWorkouts` takes them away and reads the new `lastWorkoutAt` from the `Workout(userId, completedAt)` index. Today `deleteWorkouts` runs two statements without a transaction, so its server function would open one, the way `addSetServerFn` already does (#31). Sets only change in the Current Workout, so completing a workout is the only moment its numbers settle.
- **`DailyActivity`**, one row per day (in UTC: the board has no single user's time zone), with sign-ups, workouts and sets, for the chart. A nightly job writes yesterday's row, which is simpler than keeping today's in every transaction. It reads one day of workouts, which needs an index on `Workout(completedAt)`.
- **A nightly check.** Counters kept by hand can drift, for example after a fix applied straight in SQL. The same job recomputes a batch of summaries from the tables and logs any difference.

**Rejected.**

- **Aggregating on every visit.** It is the simplest, and fine with a few thousand rows. Every visit reads the whole `Set` table, so the board slows down with every set logged.
- **A materialized view refreshed on a schedule.** It is less code, and stale data is acceptable on an admin board. But each refresh reads every table again, and "last workout" or "last sign-in" would be wrong until the next refresh. The summary table costs one small write on events that already write.

## Security

**Implemented.**

- **Passwords are hashed with argon2id** (ADR 0005, #10). Every existing plaintext password is converted once, when the container starts, so the sign-in code only knows hashes.
- **No server secret reaches the browser** (#8). A server function sent the database URL, with its password, to every visitor; another one, `getAllUsersServerFn`, returned every user with their password. Both are gone, and the signed-in user is read without the password column. `e2e/server-secrets.spec.ts` checks every response the browser receives for the database URL and for the password just typed.
- **Data belongs to its user** (ADR 0001, #18). Every server function for movements, workouts, body weight and progression requires a session and only touches that user's rows. Another user's id gets the same "not found" as an id that doesn't exist, so the answer never says which ids exist. Ids are validated as UUIDs, and an unexpected error shows a generic message, because the raw text can name tables and columns.
- **Sessions are stored in the database** (ADR 0009, #34). The cookie holds a random 32-byte token, and the table stores only its SHA-256 hash. A session lasts 15 days and slides at most once a day, with the cookie written again so the browser doesn't drop it first. It ends 90 days after sign-in in any case. Signing out deletes the row, so a copied cookie stops working too. The cookie is `httpOnly`, `SameSite=Lax`, and `Secure` everywhere except in development and test.
- **Sign-in timing doesn't reveal which emails have accounts** (#34). An unknown email is checked against a throwaway argon2id hash, so it takes as long as a wrong password. Passwords are capped at 256 characters, so one request can't hand argon2 an unbounded input.
- **One account per email address** (#34). Addresses are stored trimmed and in lower case. The migration that rewrote the existing ones refuses to run if two accounts collide, instead of merging them, because nobody verifies an address here.
- **Failed sign-ins are limited** (ADR 0012, #37). After 5 failures for one email from one IP in 15 minutes, sign-in is refused before argon2 runs, even with the right password. The IP is the connection's address; `X-Forwarded-For` is read only with `TRUST_PROXY=true`. The failures are stored in Postgres, so the limit survives a restart. Each attempt records itself before it checks the password, so 20 parallel guesses get at most 5 password checks.

**CSRF needed no code** (ADR 0009, ADR 0012). Every server function that changes data is a `POST`. The ones that use `GET` only read data, apart from renewing the reader's own session. The session cookie is `SameSite=Lax`, so the browser doesn't send it with a `POST` from another site. A form on another site can make the request, but it arrives signed out. A token would start to matter with a route that changes data on `GET`, or with a `SameSite=None` cookie. Neither exists.

**Known limits.**

- **Credential stuffing** (one password tried on many emails) isn't slowed. There is no cap per IP across all emails, because behind Docker Desktop every request arrives from the same gateway address, and such a cap would lock everyone out after one person's typos.
- **People behind one address share each email's limit** (an office NAT, a proxy without `TRUST_PROXY`, or a request with no address). Someone on that network can lock another person's account for 15 minutes. The app logs a warning once when a request brings `X-Forwarded-For` while `TRUST_PROXY` is off, or brings no address.
- **`TRUST_PROXY=true` requires that the app is reachable only through the proxy.** A request that reaches it directly could write its own `X-Forwarded-For`.
- **IPv6 counts by `/64`**, since one machine usually owns a whole `/64`, and an IPv4-mapped address counts as IPv4.
- **`email-taken`** on sign-up still tells a visitor that an address has an account. The limit only makes guessing its password expensive.

**Next steps, in order.**

1. **Sign out everywhere, and end every session when the password changes.** Each is one `deleteMany({ where: { userId } })`; both wait for an account screen.
2. **Email verification.** It makes an address a real identity, which "one account per email address" assumes today.
3. **A cap per IP, or a CAPTCHA after a few failures**, once the app runs behind a trusted proxy, against credential stuffing. That also needs a list of trusted proxy addresses instead of the single `TRUST_PROXY` switch.
4. **An `Origin` check on `POST` server functions**, as a second line behind `SameSite`.
5. **Security headers** (`Content-Security-Policy`, `Strict-Transport-Security`), which the app doesn't send today. Also the `__Host-` prefix on the session cookie, left out because it requires `Secure` and development runs on http, and `Cache-Control: private` on the `GET` server functions.

## UI polish

**The argument.** Setlist is used at the gym, between sets, with a phone in one hand. So the UI has to fit the phone, have controls big enough for a thumb, and never lose data without asking.

**Implemented.**

- **A design system first** (#23). `PRODUCT.md` says who the app is for, and `DESIGN.md` fixes the look: slate neutrals, white cards, one accent color, `lucide-react` icons and a few UI primitives. The bigger screens were prototyped first, in a few variants, and the approved one was built.
- **Screens rebuilt from approved prototypes.** The Profile with its Body Weight Chart (#26), the Movements page with muscle groups, filters and an edit dialog (#28), the Current Workout with sets grouped by movement and a form that stacks on a phone (#31), and the Progression Chart on the Workout History (#32).
- **Details.** The pointer cursor on everything clickable (#25); the card border as the hairline `DESIGN.md` describes, instead of a black outline, and pages that scroll (#26).
- **Never lose data in silence** (#35). Completing a workout with no Completed Set opens a dialog with three equal choices: save it as a Gym Visit, discard it, or keep logging. The research behind it, against apps that just block the action, is in `docs/research/empty-workouts.md`.
- **A layout for the phone** (#38). Below 768 px, the sidebar gives way to a bar at the bottom with Workout, History, Movements, Profile and Log out, where the thumb already is. Below 640 px, fields and buttons are 44 px tall with 16 px text, so iOS doesn't zoom into a field; most screens got those sizes when they were built, and #38 added the last ones. A slow navigation shows the outline of a page instead of freezing on the previous one. The e2e suite also runs on a 375 × 667 touch screen, except the tests tagged `@desktop`.

**Left, and why.**

- **Touch sizes inside `Input`, `Select` and `Button`.** Today each control on a phone screen carries its own touch-size classes; `touchField` in `src/components/ui/touch.ts` is shared only by the Profile's body weight form. Moving the size into the primitives touches every screen, so it is a change of its own.
- **Between 640 and 767 px**, the bottom bar shows while fields are already back to 40 px, as the `DESIGN.md` breakpoints say. A small tablet held upright may want 44 px up to 768 px, and that is a `DESIGN.md` change first.
- **A run on a real Safari** (WebKit, or an iPhone), for the safe area and the iOS zoom rule. The phone project runs on Chromium.
- **A "Log out?" confirmation.** Log out sits next to Profile on the bottom bar, so a stray tap signs the user out. That risk was accepted when the prototype was approved, and the confirmation is the fix if it bites.
