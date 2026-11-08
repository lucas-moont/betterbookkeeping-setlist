# Body-weight sets and progression charts: what other apps do, Recharts 3 and Postgres time zones

Research note, written 2026-11-07. Scope: how real workout apps model body-weight exercises with extra load or assistance, how they count them in volume and records, how they aggregate and draw progression charts (including breaks in training), the Recharts 3 pieces a gap-aware `TimeChart` needs, and whether the ADR 0004 query (`"completedAt" AT TIME ZONE 'UTC' AT TIME ZONE $tz`) is sound on a `timestamp(3)` column. It ends by checking the findings against ADR 0003, ADR 0004, ADR 0011 and the just-taken decision to put an `isBodyWeight` flag on each Set. The stack, as installed: recharts 3.10.1, Prisma 7.2.0 with `@prisma/adapter-pg` 7.2.0, Postgres 16.15 (`setlist-db`), Bun 1.3.10. Local checks ran on 2026-11-07. Bracketed numbers point to [Sources](#9-sources). Text marked **(analysis)** is my own reasoning, not a sourced claim.

## 1. TL;DR

- **No app I could read documents a per-set body-weight snapshot.** Hevy uses "your bodyweight" if you have entered one, and never says which entry a past workout uses [1][2]. Its API `Set` has a single `weight_kg` and no body-weight field, and body weight lives in date-keyed `body_measurements` [9]. Caliber says outright that it uses "your most recently logged bodyweight" [16], so its old numbers move whenever you weigh in. Fitbod leaves body weight out entirely [18]. Setlist's snapshot (ADR 0003) is the only approach here whose old charts never change. **Keep it.**
- **Hevy and Caliber take assistance as a positive number and let the exercise type pick the sign.** (Fitbod has no assistance concept [18].) Hevy has separate "Assisted bodyweight" and "Weighted bodyweight" types, with Load = bodyweight − assistance or bodyweight + added weight [1]. Caliber subtracts whatever is in the weight field for assisted exercises [16]. Setlist's signed `addedWeight` is fine as storage. In the form, **consider** an "added / assistance" switch that writes the sign, so the user never types a minus.
- **Body weight counts in volume only for movements that lift the whole body.** Hevy adds it only for "100 percent of bodyweight" library exercises (pull-up, chin-up, dips, handstand push-up) and leaves it out for push-ups and sit-ups [1][3]. Caliber uses a similar allow-list [16]. CONTEXT.md gives push-ups as an example of a Body-weight Movement, so Setlist's push-up Load and Volume come out higher than Hevy's. This is a **divergence**, not a bug. Keep it, but change the glossary example (§8).
- **Records for assisted sets:** Hevy gives assisted exercises no weight records at all, only rep records, because less assistance would look like less weight [4][5]. Setlist's Load = snapshot + (negative) Added Weight already makes less assistance a higher Max Weight. **Keep.**
- **Charts are per session in Hevy and Strong.** Hevy's metrics are "Session Volume" and "Session Reps", and for body-weight and assisted exercises it charts only "Most Reps (Set)" and "Session Reps" [5]. Strong compares each exercise "to the last time you performed that exercise" [13]. None of them documents which time zone decides the date. ADR 0004's per-Training-Day grouping is a deliberate difference. **Keep.**
- **No app I found marks breaks in training on a progression chart.** Hevy shows a calendar, a weekly streak, and "how many rest days you have had since your last completed workout" [7]. Fitbod lets Estimated Strength drop when an exercise "isn't logged frequently", with no stated threshold [17]. If Setlist marks gaps, the threshold is our own call.
- **Recharts 3.10.1, three pitfalls:**
  1. `ReferenceArea` defaults to `ifOverflow="discard"`, which drops the **whole** area if either corner falls outside the axis domain. For a gap that starts before the domain, use `ifOverflow="hidden"`, which clips to the plot area.
  2. `x1`/`x2` must be numbers (`getTime()`). A `Date` fails `isNumOrStr`, counts as absent, and the area then starts at the left edge.
  3. A dashed bridge across a gap is a second `<Line>` with its own `data`, `strokeDasharray`, `dot={false}` and `tooltipType="none"`.
  `ReferenceArea` has no tooltip of its own. It does pass `onMouseEnter`/`onMouseLeave` through to its rect [20][21].
- **Postgres: binding the zone as a parameter works, and the double `AT TIME ZONE` is right for `timestamp(3)`.** Prisma writes UTC wall time into the column, so `AT TIME ZONE 'UTC'` turns it into an absolute instant and `AT TIME ZONE $tz` turns that into local time. The session `TimeZone` plays no part [25][29]. **Two amendments to ADR 0004's plan:**
  1. Prisma's `$queryRaw` numbers each `${tz}` on its own (`$1`, `$2`). A `GROUP BY` that repeats the expression then fails with `42803 column ... must appear in the GROUP BY clause`. Use `GROUP BY 1` or a subquery [28][29].
  2. An unknown zone raises `22023 time zone "…" not recognized`. Prisma surfaces it as `P2010`, with `meta.driverAdapterError.cause.originalCode === "22023"`. That is the hook for the `invalid-time-zone` code. Nothing in `src/` handles it yet [28][29].
- **Edge in the new planned-set rule:** a planned body-weight set gets a fresh snapshot when it is completed again. If the lifter's body weight dropped in the meantime, an assistance that was valid when the set was logged can now exceed the snapshot. ADR 0003's CHECK then rejects the `UPDATE` with `23514`, which would surface as a 500 [29]. **Change:** re-validate Added Weight against the fresh snapshot on completion and return an expected failure.

## 2. How the apps model body-weight sets

| | Hevy | Strong | Fitbod | Caliber (found along the way) | JEFIT |
| --- | --- | --- | --- | --- | --- |
| Separate types | Yes: "Bodyweight", "Assisted bodyweight", "Weighted bodyweight" [1]. API enum for custom exercises: `weight_reps`, `reps_only`, `bodyweight_reps`, `bodyweight_assisted_reps`, `duration`, `weight_duration`, `distance_duration`, `short_distance_weight` [9] | "multiple Exercise Types, including Assisted Bodyweight and Duration Exercises" [15]. No help article on body-weight types | Custom exercises track "Reps (weight-based or bodyweight)" [19] | Bodyweight and assisted exercises from a fixed list [16] | No primary source found |
| What the user types | Added weight in the weight column, or the assistance amount [1][3] | Not documented | "For bodyweight exercises, the Weight field only accounts for any additional resistance, your body weight is not included" [18] | Added weight, or the assistance amount; "we'll now subtract whatever assisted weight you enter in the 'weight' field from your bodyweight, instead of adding it" [16] | — |
| Sign of assistance | Comes from the type: "Effective load = bodyweight − assistance" [1] | Not documented | Not applicable | Comes from the type [16] | — |
| Which body weight | "If you've entered your bodyweight in the app, the app will use that value" [1]. It can be updated during a workout ("Update Bodyweight") [1]. Whether old workouts are recomputed is not documented | Not documented. Body weight is a Measurement, synced with Apple Health [14] | Not used | "your most recently logged bodyweight" [16] | — |
| Body weight stored per set | The API `Set` has only `weight_kg`. `BodyMeasurement` is keyed by `date` [9]. **(analysis)** So the API exposes no per-set snapshot. Whether Hevy keeps one internally can't be told from outside | Not documented | No | No: it reads the latest entry [16] | — |

Notes:

- Hevy only adds body weight for library exercises, and only for some of them: "If you create a bodyweight exercise (bodyweight, assisted, or weighted) as a custom exercise, it will not add your bodyweight to the total volume" [1][3]. Caliber limits the rule to "the ones where you are actually lifting your entire bodyweight" (Pull-Up, Chin-Up, dips, Bar Muscle-Up and a few more) [16].
- **(analysis)** The Hevy API enum has no `weighted_bodyweight` value, while the app offers a "Weighted bodyweight" custom type [3]. The UI-to-API mapping isn't documented. My guess is that `bodyweight_reps` is "weighted bodyweight" and `reps_only` is plain "bodyweight", but that is unverified.
- JEFIT: the help pages and App Store listing I found mention charts and body-weight routines, but nothing about how body weight enters the numbers. No primary source, so nothing is claimed here.

## 3. Volume, max weight and 1RM for body-weight movements

- **Hevy volume:** body weight × reps for whole-body movements (10 pull-ups at 100 kg = 1,000 kg). Assisted: (bodyweight − assistance) × reps. Weighted: (bodyweight + added) × reps [1]. "If you don't add bodyweight, Hevy will not calculate volume for the exercise" [2]. Partial-body movements count only the added weight [3]. Strava differs because it "does not take your bodyweight into account in the same way" [8].
- **Hevy records by type** [4][6]:
  - Weight & reps: Heaviest Weight, Best 1RM, Best Set Volume, Best Session Volume.
  - Bodyweight: Best set (most reps), Most session reps.
  - Assisted: Best total reps, Most reps (set). "Assisted exercises do not have PRs available for weight. It may appear you are receiving incorrect PRs as you may be rewarded when you have used less assistance weight … but this is not taken into account with PRs" [4].
  - Weighted bodyweight: Heaviest weight, Best Set Volume. There is no 1RM for this type.
  - Whether "Heaviest weight" includes body weight is not documented.
- **Strong:** 1RM uses the Brzycki formula, and "for reps above 12, 1RM estimations will break down significantly" [11]. Records only count sets of 12 reps or fewer [12]. Its listing advertises "graphs for Volume and 1RM Progression" [15]. How body weight enters these numbers is not documented.
- **Fitbod:** Volume = "Sets × Reps × Weight". For body-weight exercises, Estimated Strength is "the estimated max reps you can complete in one set", and "Additional weight for bodyweight exercises isn't factored into the estimate—only reps are used" [17].
- **Caliber:** body weight now counts in Max Weight, Max Volume and 1RM records for the listed exercises. Without a logged body weight those records aren't given. Sets above 15 reps are excluded from 1RM [16].

## 4. How progression charts are aggregated

- **Hevy:** per exercise, a graph over "the last three months, year, or all time". Weight-based metrics: Heaviest Weight, One Rep Max, Best Set Volume, Session Volume, Total Reps. Bodyweight and assisted exercises get only Most Reps (Set) and Session Reps [5]. **(analysis)** "Session" means one point per workout, not per calendar day. The API's exercise history is per set, carrying `workout_start_time`/`workout_end_time` as UTC ISO timestamps [9], so the API doesn't say how dates are bucketed.
- **Strong:** "The available charts differ based on the exercise type" [10]. Focus Metric compares "to the last time you performed that exercise", with Volume (Total Volume, Volume Increase, Weight/Rep) or Reps (Total Reps, Reps/Set) [13]. That is per workout too.
- **Fitbod:** Estimated Strength trends sit in the Exercise History. The metrics depend on the exercise type: "weighted exercises track weight and volume" [17].
- **Time zone:** none of the help centers or the Hevy API says which zone decides a chart point's date. Not found, so not claimed.

## 5. Breaks in training

- No app I found draws gaps on a progression chart or documents a break threshold.
- Hevy keeps consistency off the chart: a calendar where "All days that have a workout will be highlighted in blue and the other days are considered rest days", a weekly streak ("how many weeks in a row you have completed a workout"), and "how many rest days you have had since your last completed workout" [7].
- Fitbod: "If an exercise hasn't been logged for a while, Estimated Strength may decrease to account for reduced activity" [17]. It gives no threshold.
- **(analysis)** For Setlist, a gap marker is our own design choice, so the threshold is a product decision, not something to copy. A single fixed number of days, applied to the Training Days of one Movement, keeps it lean.

## 6. Recharts 3.10.1

### 6.1 `ReferenceArea` on `XAxis type="number" scale="time"`

- `scale="time"` resolves to d3's `scaleTime` by name (`"scale" + upperFirst(type)`, `lib/state/selectors/combiners/combineConfiguredScale.js:16`) [20]. Recharts never calls `.clamp()` on a scale: the only `clamp` anywhere in `lib` is a label-positioning option in `lib/cartesian/getCartesianPosition.js`. In d3, clamping is off by default, and "if the given value is outside the domain, and clamping is not enabled, the mapping will be extrapolated such that the returned value is outside the range" [24]. So an `x1` before the domain start maps to a pixel left of the plot.
- `getRect` (`lib/cartesian/ReferenceArea.js:38–71`) maps both corners and then runs `if (props.ifOverflow === 'discard' && (!scales.isInRange(p1) || !scales.isInRange(p2))) return null;`. `isInRange` is a plain min ≤ v ≤ max check on the pixel range (`lib/util/scale/RechartsScale.js:43`) [20]. The documented values are: "`discard`: the whole component will not be drawn at all · `hidden`: the component will be clipped to the chart plot area · `visible`: the component will be drawn completely · `extendDomain`: the domain of the overflown axis will be extended", and the default is `discard` (`types/util/IfOverflow.d.ts`; defaults at `ReferenceArea.js:141`) [20].
  - **(analysis)** For a break that started before the visible window, `discard` makes it vanish entirely. `visible` paints over the Y axis. `extendDomain` fights `TimeChart`'s explicit `domain`. `hidden` (a `clipPath` to the plot, `ReferenceArea.js:125`) shows the in-window part. Clamping `x1` to the domain start in our own code works too and keeps `discard`.
- `hasX1 = isNumOrStr(x1)` (`ReferenceArea.js:114`), and `isNumOrStr` is `isNumber(value) || typeof value === 'string'` (`lib/util/DataUtils.js:44`) [20]. **(analysis)** A `Date` is neither, so it counts as absent. With one `Date` edge, that side falls back to the plot edge (`rangeMin` or `rangeMax`), so the area runs from the edge to the other corner. With both edges as `Date`s and no `y1`/`y2`, `ReferenceAreaImpl` returns `null` (`!hasX1 && !hasX2 && !hasY1 && !hasY2 && !shape`, line 118) and draws nothing. Pass epoch milliseconds, as `TimeChart` already does for its data.
- Known bug #8016: when a corner maps to `undefined` (a **band**/category axis, for example under a `Brush`), `isInRange` counts the `null` coordinate as in range and `rectWithPoints` computes `Math.min(null, x2) = 0`. The area then starts at the SVG's left edge, whatever `ifOverflow` is set to. The fix, #8017, was merged on 2026-10-17, after 3.10.1, and no stable release carries it yet (the latest releases are 3.11.0 canaries) [22]. **(analysis)** A numeric time axis always maps to a number, so this bug doesn't apply to `TimeChart`.
- Known bug #7799: every chart renders `<g tabindex="-1">` z-index layers, so a click can focus a layer, and under a global `:focus-visible` rule WebKit draws the ring around the shape, "of a `ReferenceArea`, depending on which layer was clicked". It is still present in 3.10.1 (`lib/zIndex/ZIndexPortal.js:35`) and fixed by #7805 after that release [23]. **(analysis)** `src/styles.css` has no global `:focus-visible`/`outline` rule today, so the risk is low. Remember this bug if one is ever added.
- Draw order: `ReferenceArea` sits at z-index 100 (`area`), below `line` (400) and `activeDot` (1200) (`lib/zIndex/DefaultZIndexes.js`) [21], so the shading stays under the line.

### 6.2 A dashed segment across a gap

- With `connectNulls={false}` (the default, `Line.js:132`), the d3 line uses `.defined(p => isWellBehavedNumber(p.x) && isWellBehavedNumber(p.y))` and breaks the path at any null point. With `connectNulls`, nulls are filtered out first and the path joins across them (`lib/shape/Curve.js:48, 87, 128`) [21].
- `Line` accepts its own `data` (it extends `DataProvider`, `types/util/types.d.ts:1185`) [21], so a bridge needs no second copy of the main dataset. Two lean patterns **(analysis)**:
  1. Insert one `{ x: midGap, y: null }` row into the solid line's data, so it breaks. Then draw one dashed `<Line data={[left, right]} strokeDasharray="4 4" dot={false} activeDot={false} tooltipType="none" legendType="none" />` per gap.
  2. Use one dashed `<Line connectNulls>` whose data holds only the gap endpoints. This joins neighbouring gaps into one path, so per-gap lines (1) are simpler to get right.
- A custom `strokeDasharray` survives the entrance animation: `LineDrawShape.js` builds the animated dash from the user's pattern (`computeAnimatedStrokeDasharray`, lines 115–120), and when not animating it uses the pattern as given (line 162) [21].
- The Tooltip lists every `Line` under the cursor. `tooltipType="none"` on the bridge keeps it out, and `filterNull` (default `true`, `types/component/Tooltip.d.ts:207`) drops null values [21].

### 6.3 Tooltips on `ReferenceArea`

- `ReferenceArea` has no tooltip and isn't something the chart `Tooltip` can activate. I found no official doc or issue that describes a recommended way to do it.
- What the source supports: `ReferenceArea` spreads `svgPropertiesAndEvents(props)` onto its rect (`ReferenceArea.js:133`), and the event list includes `onMouseEnter`, `onMouseLeave`, `onClick`, `onFocus` and the pointer and touch events (`lib/util/excludeEventProps.js`) [21]. Static text can go in `label` or a `<Label>` child, which render in a label context sized to the rect (`ReferenceArea.js:136–139`).
- **(analysis)** So the options are: (a) a `label` inside the area ("12 days off"); (b) `onMouseEnter`/`onMouseLeave` setting React state and rendering an HTML hint next to the chart; (c) a custom `shape` that renders a `<rect>` with an SVG `<title>`, which gives a native browser tooltip but nothing on touch. (a) is the leanest and works on phones. Unverified: whether the chart's own Tooltip, which tracks the nearest data point, also opens while the pointer is over the area. I didn't test it.

## 7. Postgres: `AT TIME ZONE` with a bound zone on `timestamp(3)`

- **Semantics.** `timestamp without time zone AT TIME ZONE zone` → `timestamp with time zone`, "assuming the given value is in the named time zone". `timestamp with time zone AT TIME ZONE zone` → `timestamp without time zone`, "as the time would appear in that zone". The zone "can be specified either as a text value … or as an interval", and `timezone(zone, timestamp)` is equivalent [25]. So `"completedAt" AT TIME ZONE 'UTC' AT TIME ZONE $tz` reads the column as UTC wall time, then shows that instant in `$tz`.
- **The column really holds UTC.** Prisma maps `DateTime` to `timestamp(3)` [27], and the migrations confirm it (`"completedAt" TIMESTAMP(3)`). Prisma's page says nothing about UTC. Locally, a `Date` of `2026-11-07T02:30:00.000Z` is stored as `2026-11-07 02:30:00`, and the latest real `Workout.completedAt` reads back the same in raw SQL (`21:27:11.83`) and through Prisma (`21:27:11.830Z`) [29]. Postgres "will silently ignore any time zone indication" for a `timestamp without time zone` value [26].
- **Bound parameter: works.** A prepared statement with `$2 text` gives `2026-11-06` for `America/Sao_Paulo` and `2026-11-07` for `Asia/Tokyo` from the same `2026-11-07 02:30` UTC value. The types are `timestamptz` after the first `AT TIME ZONE` and `timestamp` after the second. Through Prisma `$queryRaw` with `${tz}`, Postgres infers the parameter's type without a cast [29].
- **Session `TimeZone` doesn't matter.** The result is identical with `SET TimeZone = 'Pacific/Kiritimati'` [29], since neither step reads it.
- **DST.** Day boundaries follow the zone's offset on that date (New York, `2026-03-08 04:59:59` UTC → `2026-03-07`, `05:00` → `2026-03-08`). In the November fall-back, two UTC instants an hour apart both show `01:30` local, on the same date [29]. Grouping by date is unaffected.
- **Unknown zone.** `ERROR: 22023: time zone "Mars/Olympus" not recognized` (`DecodeTimezoneName`). Through Prisma 7.2 + adapter-pg it is a `PrismaClientKnownRequestError` with `code: "P2010"` and `meta.driverAdapterError.cause = { originalCode: "22023", kind: "postgres", code: "22023", message: "time zone \"Mars/Olympus\" not recognized" }` [28][29]. adapter-pg maps only a few codes to named kinds, and everything else, `22023` included, falls through to `kind: "postgres"` with the raw code (`dist/index.mjs:400–512`) [28].
- **Spellings.** `utc` and the legacy `Asia/Calcutta` are accepted [29]. An offset such as `+05:30` is accepted, but read with the sign flipped: `20:00` UTC gives `14:30` instead of Kolkata's `01:30` the next day [29]. `isValidTimeZone` in `src/lib/time-zone.ts` already refuses leading `+`/`-` for this reason. The Postgres docs say POSIX-style specs are accepted and point to Appendix B.5 for their rules [26].
- **The `GROUP BY` trap.** Prisma's `Sql` builds placeholders as `$${i}` per interpolation (`@prisma/client-runtime-utils` 7.2.0, `dist/index.mjs:2436–2441`), so the same `${tz}` used twice becomes `$1` and `$2` [28]. Postgres can't prove that `… AT TIME ZONE $1` and `… AT TIME ZONE $2` are the same expression, and fails with `42803: column "s.completed_at" must appear in the GROUP BY clause or be used in an aggregate function`. The same query with one parameter, or with `GROUP BY 1`, works [29]. **(analysis)** Write the progression query as `SELECT (…)::date AS day, … GROUP BY 1 ORDER BY 1`, or compute `day` once in a subquery or CTE.
- **(analysis)** Any raw SQL that writes `CURRENT_TIMESTAMP`/`now()` into a `timestamp(3)` column converts with the session `TimeZone`. The `set_completed_at` migration's backfill does this. It is `UTC` in `setlist-db` today [29], so the values are right, but that safety comes from the server's configuration, not from the schema.

## 8. Against our decisions

ADR 0003 (body weight copied into `Set.weight`; signed, nullable `addedWeight` with a required note; Load = `weight + coalesce(addedWeight, 0)`):

- **Keep the snapshot.** Hevy doesn't say how past workouts are handled [1], Caliber recomputes from the latest entry [16], and Fitbod ignores body weight [18]. Snapshotting is the only option here that keeps old charts stable, which is what ADR 0003 set out to do.
- **Keep the signed `addedWeight` column. Consider a sign switch in the form.** Hevy and Caliber take a positive amount and let the exercise type decide whether it adds or subtracts [1][16]. Fitbod only takes added resistance [18]. An "Added / Assistance" toggle that writes the sign needs no schema change.
- **Keep one body-weight flag instead of separate "weighted" and "assisted" types.** Hevy's three types [1] encode the sign that Setlist keeps in `addedWeight`. One flag plus a sign covers the same cases with fewer concepts.
- **DIVERGENCE: partial-body movements. Change the glossary example, keep the rule.** Hevy counts body weight only for whole-body movements and leaves out push-ups and sit-ups [1][3], and Caliber uses an allow-list [16]. CONTEXT.md lists push-ups as a Body-weight Movement, so a Setlist push-up's Load is the full body weight. A multiplier table is out of scope for a take-home. Replace "push-ups" in the CONTEXT.md example with a whole-body movement (for example chin-ups), so the flag reads as "you lift your whole body".
- **Keep body weight in Max Weight and Volume, assisted sets included.** Hevy has no weight records for assisted exercises precisely because less assistance would look like a regression [4]. Setlist's Load makes less assistance a higher Max Weight, so the Metric means the same thing for every set.
- **Consider defaulting to Total Reps for body-weight movements.** With no added weight, Max Weight just tracks body weight. Hevy charts only reps for bodyweight and assisted exercises [5], and Fitbod's estimate for body-weight exercises is max reps [17]. Opening on Total Reps when the movement is a body-weight one is a UI default, not a model change.
- **Don't add e1RM.** Strong (Brzycki, at most 12 reps) [11][12] and Caliber (over 15 reps excluded) [16] both need rep caps to keep it honest, and CONTEXT.md already rules out "1RM" as a name for Max Weight.

ADR 0004 (one point per Training Day in the user's zone, aggregated in SQL; Max Weight = max Load, Total Reps, Total Volume = sum Load × reps):

- **Keep per Training Day.** Hevy and Strong chart per session [5][13]. Setlist merges two workouts completed on the same local date into one point, which is what ADR 0004 intends, and no app documents a zone rule to compare against.
- **Keep the double `AT TIME ZONE` with a bound zone.** It is correct for `timestamp(3)` holding UTC and doesn't depend on the session zone (§7).
- **CHANGE (implementation detail the ADR's wording invites): don't repeat `${tz}` in `GROUP BY`.** Written with Prisma's tag, the query as ADR 0004 describes it fails with `42803`. Use `GROUP BY 1` or a subquery (§7). It is worth one sentence in the ADR, or a comment on the query.
- **Keep the `invalid-time-zone` code, and wire it to the real error.** Catch `PrismaClientKnownRequestError` with `code === "P2010"` and `meta.driverAdapterError.cause.originalCode === "22023"`, and let every other error throw (§7).
- **Keep the metric set.** Max Weight, Total Reps and Total Volume match Hevy's Heaviest Weight, Total Reps and Session Volume [5] without the 1RM and best-set extras.
- **Consider gap markers only with a fixed threshold.** No app marks breaks on a progression chart (§5). If Setlist adds them, use `ReferenceArea` with numeric `x1`/`x2` and `ifOverflow="hidden"`, a per-gap dashed `Line` with `tooltipType="none"`, and a `label` for the text (§6).

ADR 0011 (snapshot copied whenever a Set becomes completed; Planned Sets count toward nothing) and the new per-set `Set.isBodyWeight` (fixed when the Set is created; a planned body-weight Set shows the current Latest Body Weight on read and gets a fresh copy when completed again):

- **Keep the per-set flag fixed at creation.** It puts ADR 0003's "the change only affects Sets logged afterwards" into the data, so a Set never has to guess from its Movement's current flag. Hevy avoids the question by fixing the type on the exercise [1][9], which Setlist can't do because its flag can be toggled.
- **Keep "fresh copy on completion".** It matches Caliber's and (probably) Hevy's use of the current body weight at logging time, while still freezing it once done.
- **CHANGE: re-check the assistance bound when a planned body-weight Set is completed again.** The fresh snapshot can be lower than the one the Added Weight was checked against. With ADR 0003's CHECK (`addedWeight >= -weight`), the completing `UPDATE` then fails with `23514` [29], which would surface as a 500. Validate in the module before the update and return an expected failure (a new code in `src/lib/error-codes.ts`), so the form can ask the user to lower the assistance.
- **Keep Planned Sets out of the SQL.** The progression query must filter `"completedAt" IS NOT NULL`, so a planned Set's stored `weight`, which is stale by design, never enters a Metric.

## 9. Sources

Hevy help-center articles were read through the Zendesk Help Center API (`/api/v2/help_center/en-us/articles/<id>.json`) because the HTML pages return 403 to non-browser clients. Dates are each article's `updated_at`.

1. Hevy, "Bodyweight Exercises in Hevy: Bodyweight vs Assisted vs Weighted" (updated 2026-10-19). https://help.hevyapp.com/hc/en-us/articles/44098622782487-Bodyweight-Exercises-in-Hevy-Bodyweight-vs-Assisted-vs-Weighted
2. Hevy, "Assisted Bodyweight Exercises: How it Calculates Volume and PRs" (updated 2026-10-07). https://help.hevyapp.com/hc/en-us/articles/34380762441111-Assisted-Bodyweight-Exercises-How-it-Calculates-Volume-and-PRs
3. Hevy, "Weighted Bodyweight Exercises: Is Bodyweight Included in Volume?" (updated 2026-10-19). https://help.hevyapp.com/hc/en-us/articles/38387131819799-Weighted-Bodyweight-Exercises-Is-Bodyweight-Included-in-Volume
4. Hevy, "Set Records vs Personal Records" (updated 2026-11-07). https://help.hevyapp.com/hc/en-us/articles/38279531346455-Set-Records-vs-Personal-Records
5. Hevy, "Exercise Performance Tracking in Library (Weight, Bodyweight, Cardio and Duration Based Exercises)" (updated 2026-11-06). https://help.hevyapp.com/hc/en-us/articles/35382889578135
6. Hevy, "Personal Records (PRs) and Set Records Explained" (updated 2026-11-06). https://help.hevyapp.com/hc/en-us/articles/35649367857175
7. Hevy, "Track Your Workout Consistency with the Calendar and Streak Features" (updated 2026-11-06). https://help.hevyapp.com/hc/en-us/articles/35380117933207
8. Hevy, "Why Is My Workout Volume Different in Hevy and Strava?" (updated 2026-10-25). https://help.hevyapp.com/hc/en-us/articles/43736497456279
9. Hevy Public API Docs, OpenAPI spec version 0.0.1, embedded in https://api.hevyapp.com/docs/swagger-ui-init.js (fetched 2026-11-07): schemas `CustomExerciseType`, `Set`, `ExerciseHistoryEntry`, `BodyMeasurement`, `ExerciseTemplate`.
10. Strong Help, "About Exercise Detail Screen" (last updated 2021-02-08). https://help.strongapp.io/article/237-about-exercise-detail
11. Strong Help, "What does 1RM (One Rep Maximum) mean?" (last updated 2021-02-08). https://help.strongapp.io/article/133-1rm
12. Strong Help, "About the Records screen" (last updated 2021-02-25). https://help.strongapp.io/article/216-exercise-records-screen
13. Strong Help, "About Focus Metric" (last updated 2024-09-20). https://help.strongapp.io/article/226-focus-metric
14. Strong Help, "How to add Measurements" (last updated 2021-02-09). https://help.strongapp.io/article/238-add-measurements
15. Strong Workout Tracker Gym Log, App Store listing (fetched 2026-11-07). https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577
16. Caliber, "Bodyweight/Assisted Exercise Adjustment, Excluding High Rep Sets From 1RM" (2023-01-19). https://feedback.caliberstrong.com/announcements/bodyweightassisted-exercise-adjustment-excluding-high-rep-sets-from-1rm
17. Fitbod Help, "Fitbod Metrics & Records" (updated 2026-11-06). https://help.fitbod.me/hc/en-us/articles/12732749777047-Fitbod-Metrics-Records
18. Fitbod Help, "Exercise Details Screen: Sets, Reps, and Weight Fields Explained" (updated 2026-09-02). https://help.fitbod.me/hc/en-us/articles/29486697282711
19. Fitbod Help, "Custom Exercises" (updated 2026-10-22). https://help.fitbod.me/hc/en-us/articles/28062570249623-Custom-Exercises
20. recharts 3.10.1, local `node_modules/recharts`: `lib/cartesian/ReferenceArea.js` (`getRect`, defaults, `hidden` clip path), `lib/util/scale/RechartsScale.js` (`isInRange`, `map`), `lib/util/scale/CartesianScaleHelper.js`, `lib/util/DataUtils.js` (`isNumOrStr`), `lib/state/selectors/combiners/combineConfiguredScale.js`, `types/util/IfOverflow.d.ts`.
21. recharts 3.10.1, local: `lib/cartesian/Line.js`, `lib/shape/Curve.js`, `lib/cartesian/LineDrawShape.js`, `lib/util/excludeEventProps.js`, `lib/zIndex/DefaultZIndexes.js`, `types/cartesian/Line.d.ts`, `types/component/Tooltip.d.ts`, `types/util/types.d.ts`.
22. recharts issue #8016, "ReferenceArea is drawn from the left edge of the chart when an edge is outside the Brush range" (closed 2026-10-17 by #8017). https://github.com/recharts/recharts/issues/8016
23. recharts issue #7799, "`tabindex="-1"` on the z-index layer groups makes every chart layer mouse-focusable" (closed 2026-09-13 by #7805). https://github.com/recharts/recharts/issues/7799
24. d3-scale, "Linear scales" (clamping disabled by default; extrapolation outside the domain). https://d3js.org/d3-scale/linear
25. PostgreSQL 16 docs, §9.9.4 `AT TIME ZONE`, Table 9.34. https://www.postgresql.org/docs/16/functions-datetime.html
26. PostgreSQL 16 docs, §8.5.1.3 Time Stamps and §8.5.3 Time Zones. https://www.postgresql.org/docs/16/datatype-datetime.html
27. Prisma docs, "PostgreSQL" database connector, type mapping (`DateTime` → `timestamp(3)`). https://www.prisma.io/docs/orm/overview/databases/postgresql
28. Prisma 7.2.0, local: `@prisma/client-runtime-utils/dist/index.mjs` (`Sql.text`, lines 2436–2441) and `@prisma/adapter-pg/dist/index.mjs` (`convertDriverError`/`mapDriverError`, lines 400–512).
29. Local checks on 2026-11-07 against PostgreSQL 16.15 (`setlist-db`, session `TimeZone` = `UTC`): prepared statements for `AT TIME ZONE` with a bound zone, session-zone, DST, offset and alias cases, the unknown-zone error, `GROUP BY` with one parameter vs two vs `GROUP BY 1`, and a CHECK `added >= -weight` on a temp table. Bun 1.3.10 scripts with Prisma 7.2.0 + adapter-pg against the dev database (read-only `SELECT`s): `$queryRaw` with a bound zone, the `P2010`/`22023` error shape, a `Date` → `timestamp(3)` round trip, and `Sql.text` placeholder numbering. Scripts are in the session scratchpad, not the repo.
