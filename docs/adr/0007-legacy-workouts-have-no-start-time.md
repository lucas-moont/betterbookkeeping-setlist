# Legacy workouts have no start time

`Workout` gains `startedAt` so the Current Workout can show when it started, and so a later feature can measure workout duration. Workouts created before this change have no record of when they started, so their `startedAt` stays `NULL`. The column is nullable in the database, but every new workout must have one. Code that reads `startedAt` treats `NULL` as "unknown".

## Considered Options

- **Backfill with `completedAt`.** Makes the column non-null, but gives every old workout a duration of zero, which is a false value that would skew any duration metric.
- **Backfill with the migration time.** Makes every old workout look like it started at the same moment, and completed ones would get negative durations.
