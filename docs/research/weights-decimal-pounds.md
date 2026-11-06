# Storing weights: `numeric(6,2)` vs. centi-pound integers vs. floats

Research note, written 2026-11-06. Scope: how Setlist should store and move every Weight (pounds, at most 2 decimals, max 9999.99). That covers `Set.weight` today (`Int`, `prisma/schema.prisma`) and, later, `addedWeight` and Body Weight Entries (ADR 0003, not in the schema yet). The question is whether the accepted ADR 0002 (`numeric(6,2)` / Prisma `Decimal @db.Decimal(6, 2)`, converted to `number` inside each domain module) is the best option. The stack, as resolved in `bun.lock`: Prisma 7.2.0 with `@prisma/adapter-pg` 7.2.0 (`pg` 8.17.1), `@tanstack/react-start` 1.150.0 with seroval 1.4.2, zod 4.3.5, and Postgres 16.15 (`postgres:16-alpine`). Local checks ran on Node 24.14.0 against the Docker Postgres. Bracketed numbers point to [Sources](#8-sources). Text marked **(analysis)** is my own reasoning, not a sourced claim.

## 1. TL;DR

- **Keep ADR 0002: `numeric(6,2)` plus `Decimal.toNumber()` at the module boundary.** Given the "at most 2 decimals" rule, options 1 and 2 are equally exact. I checked all 1,000,000 values from 0.00 to 9999.99: each one survives `Number(str)`, `new Decimal(str).toNumber()`, `toFixed(2)`, `Math.round(n*100)` and `c/100` without error [13]. Neither option is "more correct". What separates them is where the ×100 lives. With `numeric` it lives in the database type. With centi-pounds it lives in every write, every read, every raw SQL expression, and every `psql`/Prisma Studio session, where `13550` means 135.50 lb. **(analysis)**
- **Rule out `double precision`.** Every CHECK I tried for "2 decimals" is wrong in one direction or the other (§4.3). `sum(float8)` over 10,000 sets of 135.55 gave `1355500.0000002538`, while `numeric` gave `1355500.00` [13].
- **Amendments the ADR's plan needs, whichever option wins:**
  1. zod `multipleOf(0.01)` sets **no upper bound**. It accepts `10000`, and Postgres then raises `numeric field overflow`, which surfaces as a 500. Add `.max(9999.99)` [11][13].
  2. The raw SQL for ADR 0004 gets `Decimal` for `numeric` and **`BigInt`** for `sum(int)` [5][7]. Cast in SQL (`::float8`, `::int`) so raw rows are plain numbers.
  3. The weight `<input type="number">` has no `step`, so it defaults to integers. It also parses with `parseInt`, which silently drops the decimals. Use `step="0.01"` and `Number(...)`.
- **Cheapest moment:** today. Only `Set.weight` exists (751 dev rows, max 315), and `addedWeight` and Body Weight Entries haven't been built yet.

## 2. Options compared

|                               | 1. `numeric(6,2)` + `Decimal`, converted to `number` (ADR 0002)                                                                 | 2. `Int` in centi-pounds                                                              | 3. `double precision` / `Float`      | 4a. bare Prisma `Decimal`                  | 4b. `Decimal` across the wire (adapter or string)           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------ | ----------------------------------------------------------- |
| Exact in storage              | Yes [1]                                                                                                                         | Yes                                                                                   | No: "stored as approximations" [1]   | Yes                                        | Yes                                                         |
| DB enforces ≤2 decimals       | Yes, but by **rounding** (`135.555` becomes `135.56`), not rejecting [1][13]                                                    | Implicitly (integers)                                                                 | No. Every CHECK leaks (§4.3)         | **No.** Prisma emits `DECIMAL(65,30)` [12] | Same as 1                                                   |
| DB enforces max               | Yes: `numeric field overflow` above 9999.99 [13]                                                                                | Needs a CHECK                                                                         | Needs a CHECK                        | No                                         | Same as 1                                                   |
| Size per value                | Variable: "two bytes for each group of four decimal digits, plus three to eight bytes overhead" [1]. `pg_column_size` = 10 [13] | 4 bytes [1]                                                                           | 8 bytes [1]                          | Variable                                   | Same as 1                                                   |
| SQL aggregates                | `max` gives `numeric`, `sum` gives `numeric`, `numeric*int` gives `numeric`, all exact [2][13]                                  | `sum(int)` gives `bigint`. `int4*int4` **overflows** (`integer out of range`) [2][13] | `sum` gives `float8` and drifts [13] | Same as 1                                  | Same as 1                                                   |
| What Prisma returns           | `Decimal` (decimal.js 10.5.0) [4][8]. Raw: `Decimal` [5][7]                                                                     | `number`. Raw `sum`: `BigInt` [5][7]                                                  | `number`                             | `Decimal`                                  | `Decimal`                                                   |
| Server-function boundary      | Convert first. A `Decimal` makes seroval **throw** (§4.4)                                                                       | Plain numbers                                                                         | Plain numbers                        | Convert first                              | Needs a seroval adapter, and decimal.js ships to the client |
| Conversion sites in this repo | Read: `.toNumber()` in `toSet`/raw rows. Write: pass `number`                                                                   | Write ×100, read ÷100, every raw SQL ÷100, every new weight column                    | None                                 | Same as 1                                  | Every screen does Decimal math                              |
| Migration                     | Prisma generates it [12]                                                                                                        | Hand-written data migration                                                           | Prisma generates it [12]             | Generated [12]                             | Same as 1                                                   |
| Verdict                       | **Recommended**                                                                                                                 | Credible runner-up                                                                    | Reject                               | Reject                                     | Reject                                                      |

## 3. What the code costs (this repo)

**Option 1 (analysis, based on the files read):**

- `prisma/schema.prisma`: `weight Decimal @db.Decimal(6, 2)`. `prisma migrate diff` emits exactly `ALTER TABLE "Set" ALTER COLUMN "weight" SET DATA TYPE DECIMAL(6,2);` [12], with no `USING` because the assignment cast is the default [3]. Changing a column's type "will require the entire table and its indexes to be rewritten" unless the types are binary coercible [3], and int to numeric aren't. It takes an `ACCESS EXCLUSIVE` lock [3], which is harmless at this size. Any existing row ≥ 10000 would abort the migration with `numeric field overflow` [13]. The dev data maxes out at 315. Production data is unknown.
- `src/lib/workouts/index.ts` `toSet`: `weight: row.weight.toNumber()`. Call `load()` on the converted numbers, because `load()` takes `number`.
- `addSet` write: Prisma's input type accepts a plain `number` (`JsInputValue` includes `number` and `DecimalJsLike`) [7]. For every 2-decimal value, `String(n)` is the canonical decimal, so nothing is lost on the way in [13]. I did **not** run an actual insert into a `Decimal` column through Prisma 7.2.
- `src/lib/workouts/set-draft.ts`: `weight: z.number().min(0).max(9999.99).multipleOf(0.01)`.
- ADR 0004 raw query: return `max(load)::float8`, `sum(load * reps)::float8` and `sum(reps)::int`. Postgres computes the exact `numeric` result, and the single cast at the end is the closest double to that result, which prints back as the same 2-decimal string as long as totals stay below about 2^53/100. Prisma maps `double precision` to `Number` and `int4` to `Number` [5].
- Tests: the existing integer cases (`weight: 225`) still pass. Add round trips for `135.55`, `0.07` and `9999.99`, a rejection of `10000`, and a rejection of `1.005`.

**Option 2, additionally:** Prisma sees no change from `Int` to `Int`, so the migration is hand-written (`UPDATE "Set" SET "weight" = "weight" * 100`, ideally with a rename to something like `weightCentiLb` so nobody reads `13550` as pounds). Add `Math.round(w * 100)` on write (exact for all values [13]) and `/ 100` on read. In SQL, `/100.0` plus `::bigint` on one operand of `weight * reps`, because `int4 * int4` overflows [13] (999999 × 2148 > 2^31). `sum(int)` still comes back as `bigint`, which Prisma turns into `BigInt` [2][5]. Every future weight column (`addedWeight`, Body Weight Entries) repeats the convention, and ADR 0002 has to be rewritten.

**Every option:** the history page's per-movement max uses `s.weight` (`_layout.workout-history/index.tsx:138`). Under CONTEXT.md, Max Weight is the highest **Load**, so this should use `load`.

## 4. Findings per question

### 4.1 Postgres: exactness, size, speed, aggregates

- `numeric` is "especially recommended for storing monetary amounts and other quantities where exactness is required". Postgres also warns: "calculations on `numeric` values are very slow compared to the integer types, or to the floating-point types" [1]. **(analysis)** A Training Day aggregate scans one user's sets for one Movement, perhaps a few thousand rows, so the speed gap doesn't matter here. The 10-byte vs. 4-byte size gap doesn't either, next to the two 36-character UUID foreign keys on each `Set` row.
- When the input has more decimals than the column, "the system will round the value to the specified number of fractional digits", and too many integer digits "raise an error" [1]. Verified: `135.555::numeric(6,2)` = `135.56`, `1e-7` gives `0.00`, and `10000` raises `numeric field overflow` [13]. So the database is a backstop that rounds. zod is the gate that rejects.
- Result types: `sum(integer)` gives `bigint`, `sum(numeric)` gives `numeric`, `avg(integer)` gives `numeric`, and `max` keeps the input type [2]. `int*int` is `integer`, and `99999*99999` gives `ERROR: integer out of range`. `numeric(6,2)*int` is `numeric` [13].
- Arithmetic: `150.1::numeric(6,2) + 2.2::numeric(6,2)` = `152.30`, while `float8` gives `152.29999999999998` [13]. This matches the ADR's example.

### 4.2 Prisma 7.2 and the pg driver adapter

- Model fields: "`Decimal` fields are represented by the `Decimal.js` library" [4]. The runtime bundles decimal.js v10.5.0 [8].
- `adapter-pg` overrides `pg`'s parser for `numeric` (OID 1700) with `normalize_numeric(numeric) { return numeric; }`, which keeps the exact string, and maps the column to `ColumnTypeEnum.Numeric` [6]. The client runtime then deserialises `"decimal"` into a new `Decimal` and `"bigint"` into a JS `BigInt` [7]. This agrees with the docs' raw mapping table: "Decimal / numeric → `Decimal`", "64-bit integer → `BigInt`", "Double precision → `Number`" [5]. I found no switch in 7.2 to get numerics back as strings or numbers. That absence is unverified beyond the source I read.
- `new Decimal(0.1).toString()` is `"0.1"` and `new Decimal(135.55).toString()` is `"135.55"`. decimal.js reads a JS number through its shortest string form, and for all 1,000,000 values `new Decimal(String(n))` equals the canonical decimal [13].
- Prisma "sends JavaScript integers to PostgreSQL as `INT8`" in raw queries, so parameters may need casts [5].
- Without `@db.Decimal(6, 2)`, Prisma's default is `DECIMAL(65,30)` [12]. That would drop the database's 2-decimal and max guarantees.

### 4.3 Why floats fail here

Every CHECK I tried for "2 decimals" on `float8` is wrong in one direction or the other [13]:

- `w*100 = round(w*100)` **rejects the valid 0.07**, because `0.07::float8*100` = `7.000000000000001`.
- `round(w::numeric,2) = w::numeric` **accepts `0.1+0.2`**, because the cast to numeric rounds `0.30000000000000004` to `0.3`.
- `abs(w*100 - round(w*100)) < 1e-6` works, but it lets values that are off by up to that tolerance (not exactly 2 decimals) into storage.
- Aggregates drift (`1355500.0000002538`). Equality comparisons "might not always work as expected" [1].

### 4.4 TanStack Start serialization (seroval 1.4.2)

- Server-function results go through `toCrossJSONStream(res, { plugins })`, using `getDefaultSerovalPlugins()` [9].
- Runtime test with the locked versions: `{ weight: new Decimal("135.5") }` **throws** `SerovalParserError: The value [object Decimal] of type "object" cannot be parsed/serialized`. Any class instance behaves the same way. It is not silently turned into a plain object [9][13]. `BigInt` does round-trip (`12n`) [13], so a stray `sum(int)` wouldn't crash the response. It would reach the client as a `bigint`, which `Math.max` and chart libraries don't accept. **(analysis)**
- Plain `JSON.stringify` would have turned it into `"135.5"` silently [13]. seroval failing loudly is actually the better outcome.
- An escape hatch exists: `createSerializationAdapter({ key, test, toSerializable, fromSerializable })`, registered through `serializationAdapters` in `createStart` [10]. Using it means shipping decimal.js to the browser and doing Decimal arithmetic in components (option 4b). **Unverified:** whether Start's `ValidateSerializable` types flag a leaked `Decimal` at compile time. I didn't compile a probe.

### 4.5 zod 4.3.5 `multipleOf(0.01)`

- Implementation [11]: `floatSafeRemainder(val, step)` counts the decimals in `val.toString()` and in `step`, turns both into integers with `toFixed(decCount)`, removes the dot, `parseInt`s them, and takes the integer remainder. Checks [13]:
  - **All 1,000,000 values 0.00–9999.99 and all negatives down to −9999.99 are accepted.** That includes `135.55`, `0.29`, `1.15`, `0.07` and `-20.05`, so it works for signed Added Weight too.
  - **Rejected:** `1.005`, `0.004`, `2.75578`, `0.1+0.2` and `150.1+2.2`. A client that computes a weight must round it before sending.
- Edge cases:
  1. No upper bound: `10000` is accepted.
  2. Numbers whose `toString()` is exponential (below 1e-6, for example `1e-7` or `9.99e-7`) count as having 0 decimals. `toFixed(2)` turns them into `"0.00"`, so they're **accepted**, and Postgres stores them as `0.00`. **(analysis)** This is harmless, but it is the one case where an input gets rounded rather than rejected, which goes against the ADR's rule.

### 4.6 Is 2 decimals enough? Is 9999.99 a sane max?

- **IPF Technical Rulebook (effective 1 March 2026)** [16]:
  - §2.1 Scales: "must be of an electronic digital type and register to the second place of decimals", which is 0.01 kg.
  - Discs: "1.25 kg, 2.5 kg, 5 kg … 25 kg". For records, lighter discs may reach "0.25 kg, 0.5 kg".
  - Discs must "weigh within 0.25 percent or 10 grams of their face value". The table gives 0.245–0.255 kg for a 0.25 kg disc.
- **Pound fractional plates** go down to 0.25 lb (Rogue LB Fractional Plates: 0.25, 0.5, 0.75, 1 lb) [17]. I took this from the search listing and did not open the product page.
- **Converting kilograms:** 1 lb = 0.453 592 37 kg exactly [18], so 1.25 kg = 2.7557782… lb. **(analysis)**
  - 2 decimals in pounds means a resolution of 0.01 lb ≈ 4.5 g. That's finer than an IPF scale (0.01 kg ≈ 0.022 lb) and smaller than the ±10 g tolerance on a disc.
  - Rounding a kg-derived value to 2 decimals moves it by at most 0.005 lb (2.3 g). That's well within a plate's own error, so 2 decimals is enough.
  - The catch is product behaviour: zod rejects `2.7557…` instead of rounding it. Any future kg input has to round on the client.
- **Max 9999.99 (analysis, unsourced):** the heaviest barbell lifts on record are around 1,100 lb, and plate-loaded sleds can exceed 1,000 lb. 9999.99 leaves about 9× headroom. Volume and totals are computed, never stored, so the cap doesn't limit them. Consumer bathroom scales are usually 0.1 or 0.2 lb. I didn't verify that against a manufacturer.

### 4.7 Does "money in cents" transfer?

- Stripe: "The Stripe API expects currency values using the given denomination's smallest unit represented without decimals. For example, enter 1099 to charge 10.99 USD" [14]. The page served in Portuguese, so I quoted its English text.
- Fowler: "Monetary calculations are often rounded to the smallest currency unit … it's easy to lose pennies … because of rounding errors" [15]. The page doesn't prescribe integer storage. The pattern's details are in _PoEAA_ ch. 18, which I didn't read. Fowler's separate "Quantity" page returned 404.
- **(analysis)** Cents work because a currency's smallest unit is a fixed fact: there is no 0.001 USD. Weight has no such unit. 0.01 lb is a resolution we chose, for a measured quantity whose unit might change one day (kg). In both options the exactness comes from the 2-decimal rule, not from the storage type. Cents-style integers also pay off mainly when the code does a lot of arithmetic and rounding (tax, splits). Here there are three sums, and Postgres `numeric` does them exactly. The real benefit of option 2 is avoiding `Decimal` objects, and in option 1 that costs one `.toNumber()` per row plus a `::float8` per raw column.

## 5. Things I could not verify

- How Prisma 7.2 writes a JS `number` into a `Decimal` column. Inferred from the runtime types and adapter source, not run.
- Whether TanStack Start reports a leaked `Decimal` at compile time (`ValidateSerializable`).
- That Prisma 7.2 has no option to return `numeric` as a string or number.
- The Rogue product page (taken from search results), consumer scale resolutions, and lift records.
- Production data: whether any `Set.weight` is ≥ 10000, which would make the `ALTER` fail.

## 6. Reproduction (local, read-only)

- **Node:** loops over `c = 0..999999` (and negatives), comparing `c/100`, an integer-built canonical string, `Decimal`, `toFixed` and `Math.round(x*100)`. Plus zod `safeParse` on edge values, a seroval `toCrossJSONAsync` of a `Decimal`/`BigInt` with Start's default plugins, and 2,000,000 random `load()` pairs (0 mismatches).
- **psql on 16.15:** `pg_typeof` of the aggregates, the overflow cases, the float CHECK expressions, `sum` drift, `pg_column_size`.
- **Prisma:** `bunx prisma migrate diff --from-schema … --to-schema … --script` on scratch copies of the schema.

## 7. Recommendation, restated

Keep ADR 0002 and add one paragraph to it:

- "zod: `.min(0).max(9999.99).multipleOf(0.01)`."
- "Raw SQL returns `::float8` / `::int` so rows are plain numbers."
- "Centi-pound integers were considered. They are just as exact, but every read, write and SQL expression has to scale, and the money analogy doesn't hold for a measured quantity."

**Postscript (same day, after review).** The shipped rule is `weightSchema` in `src/lib/weight.ts`. It keeps the `.max(9999.99)`, but it replaces `multipleOf(0.01)` with one check: refuse any value that rounding to two decimals would change (`Math.round(w * 100) / 100 === w`, the rounding `load()` already uses). That one check also refuses `1e-7` without a special case, works for negative Added Weight, and accepts all 2,000,000 two-decimal values in ±9999.99.

## 8. Sources

1. PostgreSQL 16 docs, §8.1 Numeric Types. https://www.postgresql.org/docs/16/datatype-numeric.html (fetched 2026-11-06)
2. PostgreSQL 16 docs, §9.21 Aggregate Functions, Table 9.59. https://www.postgresql.org/docs/16/functions-aggregate.html
3. PostgreSQL 16 docs, ALTER TABLE (SET DATA TYPE, Notes, lock levels). https://www.postgresql.org/docs/16/sql-altertable.html
4. Prisma docs, "Fields & types (Prisma ORM v7)". https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types
5. Prisma docs, Raw queries: raw query type mapping and type caveats. https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries
6. `@prisma/adapter-pg` 7.2.0, `dist/index.mjs` (`fieldToColumnType`, `normalize_numeric`, `customParsers`, `getTypeParser` override). Local `node_modules`.
7. `@prisma/client` 7.2.0, `runtime/client.mjs` (raw result deserialiser: `decimal` gives `Decimal`, `bigint` gives `BigInt`) and `runtime/client.d.ts` (`JsInputValue`). Local.
8. `@prisma/client-runtime-utils` 7.2.0 `dist/index.mjs`, which bundles decimal.js v10.5.0. Local.
9. seroval 1.4.2 (development build) and `@tanstack/start-server-core` 1.150.0 `dist/esm/server-functions-handler.js` (`toCrossJSONStream`, `getDefaultSerovalPlugins`). Local, plus the runtime test.
10. `@tanstack/router-core` 1.150.0 `dist/esm/ssr/serializer/transformer.d.ts` (`createSerializationAdapter`, `ValidateSerializable`); `@tanstack/start-client-core` `createStart.d.ts` (`serializationAdapters`). Local.
11. zod 4.3.5 `v4/core/util.js` (`floatSafeRemainder`) and `v4/core/checks.js` (`$ZodCheckMultipleOf`). Local.
12. `prisma migrate diff --script` output, Prisma 7.2.0 (`Decimal @db.Decimal(6, 2)`, bare `Decimal`, `Float`). Local run, 2026-11-06.
13. Local checks on 2026-11-06: PostgreSQL 16.15 (`setlist-db`), Node 24.14.0 scripts in the session scratchpad.
14. Stripe docs, "Supported currencies: Specify amounts in API requests". https://docs.stripe.com/currencies (served in pt-BR; English text quoted)
15. Martin Fowler, "Money" (PoEAA catalog). https://martinfowler.com/eaaCatalog/money.html
16. IPF Technical Rulebook 2026, effective 01 March 2026 (v3), Irish Powerlifting Federation mirror, §2.1 Scales and disc specifications. https://www.irishpowerliftingfederation.com/wp-content/uploads/2026/03/2026-IPF-Technical-Rulebook-effective-01-March-2026-v3.pdf
17. Rogue LB Fractional Plates (search listing). https://www.roguefitness.com/rogue-lb-fractional-plates
18. NIST SP 811, Appendix B footnotes, fn 22: "The exact conversion factor is 4.535 923 7 E-01". https://www.nist.gov/pml/special-publication-811/nist-guide-si-footnotes
