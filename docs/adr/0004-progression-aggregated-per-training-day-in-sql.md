# Progression is aggregated per Training Day in SQL, in the browser's time zone

A Training Day is the calendar date on which a Workout was completed, in the user's time zone. The server doesn't know that zone, so the browser sends its IANA zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) with the query. The server checks it against `Intl.supportedValuesOf("timeZone")`, and Postgres groups the sets by `("completedAt" AT TIME ZONE 'UTC' AT TIME ZONE $tz)::date`, returning one row per day with Max Weight, Total Reps, and Total Volume. Prisma's query builder can't group by a computed date, so this is the one place the code uses raw, parameterised SQL (`$queryRaw`).

## Considered Options

- **Compute in the browser from the workout history query.** No new query, but it downloads every set the user has ever logged, and that grows without limit.
- **Store a time zone on the user.** Needs a settings field, and the dates come out wrong while the user travels.

## Consequences

The browser owns the calendar everywhere, not just here. A Body Weight Entry's date is stored as a Postgres `date`, but Prisma returns it as a JS `Date` at UTC midnight, and a browser west of UTC (São Paulo) would show it as the day before. Calendar dates therefore cross the server-function boundary as `"YYYY-MM-DD"` strings, and the browser sends "today" as a string too.

The same data can produce slightly different charts when viewed from two time zones. That's acceptable: the chart answers "what did I lift on the days I remember", and those days are in the user's local time.
