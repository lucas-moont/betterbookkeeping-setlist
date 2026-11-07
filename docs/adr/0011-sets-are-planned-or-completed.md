# Sets are planned or completed, marked by `Set.completedAt`

A lifter can now say, set by set, what they actually did. A Set is a **Completed Set** while `Set.completedAt` holds the moment it was completed, and a **Planned Set** while it is `NULL`. Every Set is added completed, as the README describes ("log every set as you go"), so logging stays one step; un-completing a Set marks one that wasn't done, and completing it again puts it back. Only Completed Sets count: every Metric, set count and a Workout's Muscle Groups filter on `completedAt IS NOT NULL`, and a Planned Set left in a Completed Workout stays in the history as not done.

We store a timestamp, not a boolean, because it records when the Set was done at no extra cost, and the Workout's own `completedAt` already gives the word its meaning. The state changes only while the Workout is the Current Workout: completing or un-completing a Set of a Completed Workout, or of another user, gets the same `set-not-found` as an id that doesn't exist.

## Considered Options

- **Every Set starts planned, and the lifter completes each one.** The history would only hold what was ticked, but it changes the README's basic flow: someone who adds Sets and completes the Workout would get an empty workout, and every existing flow would need an extra tap per Set.
- **A "Completed" checkbox on the form, checked by default.** Tried in the prototype and dropped: next to the movement picker it read as completing the whole exercise, not one Set.
- **`isDone Boolean`.** Same queries, but it throws away when the Set was done.
- **A separate `PlannedSet` table, moved into `Set` when completed.** Planned and completed rows would never mix in a query, but completing would be a delete plus an insert, the Set's id would change under the screen, and un-completing would move it back.

## Consequences

**Migration.** Every existing Set was logged after it was done, so the migration backfills `completedAt` with its Workout's `completedAt`, or with the migration time for Sets of a Workout that is still open. No existing Set becomes planned.

**`Set.createdAt` arrives here, ahead of ADR 0007's other columns.** Un-completing a Set is an `UPDATE`, and Postgres can return an updated row in a different position, so without a defined order a Set could jump in the list when its circle is tapped. Sets are sorted by `createdAt`, then `id`, as ADR 0007 describes. Legacy Sets get the migration time as `createdAt`, which puts it after their `completedAt`; that's expected, since a legacy `createdAt` means nothing. Several Sets added in one request share a `createdAt` (millisecond precision) and fall back to `id`, which keeps their order stable.

**Body Weight Snapshot (ADR 0003).** The snapshot is copied each time a Set of a Body-weight Movement becomes completed: when it is added, and again when it is completed after being un-completed. A Planned Set shows the Latest Body Weight of the moment and stores none, so un-completing a Set clears its snapshot. Completing a Set that is already completed changes nothing, neither the time nor the snapshot, so a double click is harmless.

**A Workout's Muscle Groups are derived, never stored.** They are the Muscle Groups of the Movements of its Completed Sets, without repeats, in the fixed order of the list. They are computed when the Workout is read, from the rows the read already loads, so changing a Movement's Muscle Group changes every Workout that used it, including old ones. Muscle Group is a Postgres enum: the list is fixed and its order is the enum's, and adding a group later takes an `ALTER TYPE ... ADD VALUE` migration.
