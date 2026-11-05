# Weights are decimal pounds

`Set.weight` was an `Int` and the UI hard-codes "lbs". Body Weight Entries pre-fill the Set weight field, so both have to share one type and one unit, and body weight needs decimals (172.4 lb). Every weight is stored as pounds in a Postgres `numeric(6,2)` column (Prisma `Decimal @db.Decimal(6, 2)`), which allows values up to 9999.99 lb.

## Considered Options

- **Kilograms.** Changes the meaning of every existing row and all UI copy.
- **A unit per user.** Means converting values at every input and display, for a product that only uses one unit today.
- **Keep `Int`.** Can't record a body weight like 172.4.

## Consequences

Prisma returns `Decimal` objects, which aren't plain JSON. Server functions convert them to `number` before returning data, so the client only ever sees numbers. Two decimal places is enough for lifting, so `number` loses nothing in practice.
