# Weights are decimal pounds

`Set.weight` was an `Int` and the UI hard-codes "lbs". Body Weight Entries pre-fill the Set weight field, so both have to share one type and one unit, and body weight needs decimals (172.4 lb). Every weight is stored as pounds in a Postgres `numeric(6,2)` column (Prisma `Decimal @db.Decimal(6, 2)`), which allows values up to 9999.99 lb.

## Considered Options

- **Kilograms.** Changes the meaning of every existing row and all UI copy.
- **A unit per user.** Means converting values at every input and display, for a product that only uses one unit today.
- **Keep `Int`.** Can't record a body weight like 172.4.
- **Integer hundredths of a pound** (like money in cents). Just as exact for two decimals, and no `Decimal` objects. But every write multiplies by 100, every read and every raw SQL expression divides by 100, and every future weight column repeats the convention. Cents also work because a currency has a fixed smallest unit; 0.01 lb is only the resolution we chose.
- **`double precision`.** No CHECK can enforce two decimals on a float, and sums drift.

## Consequences

Prisma returns `Decimal` objects, which aren't plain JSON. Each domain module (`src/lib/<domain>/index.ts`, ADR 0010) converts them to `number` before returning, so server functions, tests, and the client only ever see numbers. Two decimal places is enough for lifting, so `number` loses nothing in storage.

Arithmetic is where `number` can drift: in JavaScript `150.1 + 2.2` is `152.29999999999998`, while Postgres `numeric` gives `152.30`. Load is therefore computed in one place, `load()` in `src/lib/weight.ts`, which rounds to two decimals, and input validation rejects more than two decimals instead of rounding them silently.

The column rounds extra decimals and only errors above 9999.99, so validation is the gate. Every weight field validates with `weightSchema` in `src/lib/weight.ts`: at most 9999.99 either way, and a value that rounding to two decimals would change is refused. Each caller adds its own minimum (0 for a Set's Weight; Added Weight may be negative, ADR 0003). zod's `multipleOf(0.01)` alone is not enough: it has no upper bound, so 10000 would reach Postgres as a `numeric field overflow`, and it lets through numbers small enough to print in exponent form (`1e-7`), which the column stores as 0.00. Raw SQL (ADR 0004) gets `Decimal` for `numeric` and `BigInt` for `sum(integer)`, so it casts its results (`::float8`, `::int`) to return plain numbers. A `Decimal` that slipped through would make the server function fail, because TanStack Start can't serialize it. The comparison, with sources, is in `docs/research/weights-decimal-pounds.md`.
