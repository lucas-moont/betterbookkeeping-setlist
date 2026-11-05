# Body-weight sets snapshot body weight and record added weight apart

For a Set of a Body-weight Movement, `weight` holds the Body Weight Snapshot: the user's latest body weight, copied in when the set is logged. Extra load or assistance goes in a signed, nullable `addedWeight`, with `addedWeightNote` required whenever `addedWeight` is set (for example `+10`, "weighted vest", or `-20`, "red band"). For any other movement `addedWeight` is null and `weight` is what's on the bar. Load is always `weight + coalesce(addedWeight, 0)`, so every Metric uses one formula for every set.

We snapshot instead of joining Sets to Body Weight Entries at read time. That way recording, editing, or deleting a body weight never rewrites past Progression Charts.

## Considered Options

- **Store the total Load in `weight`, with the snapshot and added weight beside it.** Queries get slightly simpler, but the same fact is stored twice and the copies can drift.
- **Store no weight on body-weight sets, and look up the body weight for that date when reading.** No duplication, but history changes whenever the user corrects an old entry, and every metric query needs a date-range join.

## Consequences

The snapshot is locked: the form never lets the user change the base weight of a body-weight set, so there is exactly one way to express "I lifted more than my body", which is Added Weight with a note. The one exception is a user with no Body Weight Entry yet. The form asks for their body weight, uses it as the snapshot, and records it as today's Body Weight Entry in the same request.

Two guards keep the snapshot honest. Added Weight can be negative, but never below `-weight`, so Load is never negative (zod and a CHECK constraint). And a Body Weight Entry can't be dated in the future, or it would become the Latest Body Weight and be copied into every new set until that date arrives. The form rejects dates after the browser's today; the server, which only knows UTC, rejects dates after UTC today plus one day.

The body-weight flag can be turned on or off after sets exist, and existing sets are left alone. They stay correct either way, because Load never reads the flag: a set logged as body-weight keeps its snapshot and added weight, and a set logged with a barbell keeps its bar weight. The flag only changes the default and the form for sets logged afterwards, so no data migration is needed.
