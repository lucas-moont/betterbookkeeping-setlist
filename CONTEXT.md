# Setlist

A strength training log. A lifter records what they lift, set by set, and the app shows whether they are getting stronger.

## Language

### Training

**Movement**:
An exercise in a user's own library, such as "Bench Press". Each user owns their movements; nobody else sees or changes them. Names are unique per user, ignoring case.
_Avoid_: Exercise, lift

**Body-weight Movement**:
A Movement where the load is the lifter's own body, such as pull-ups, push-ups, or dips. A user can turn this on or off at any time; the change only affects Sets logged afterwards.
_Avoid_: Calisthenics, bodyweight exercise

**Workout**:
One training session made of Sets.
_Avoid_: Session, training

**Current Workout**:
A Workout that has not been completed yet. A user has at most one. Sets can only be added to or removed from the Current Workout.
_Avoid_: Active workout, open workout

**Completed Workout**:
A Workout the user has marked complete. It is part of the user's history and its Sets no longer change.
_Avoid_: Finished workout, past workout

**Set**:
One Movement performed for a number of Reps at a Weight, inside a Workout.
_Avoid_: Entry, exercise

**Reps**:
How many times the Movement was performed in a Set. Always at least one.
_Avoid_: Repetitions, count

### Weight

**Weight**:
A mass in pounds, with decimals allowed (for example 72.5 lb). Every weight in Setlist uses this unit.
_Avoid_: Kilos, load (when you mean the number typed in a form)

**Body Weight Entry**:
The lifter's body weight on one calendar date. A user has at most one entry per date; recording again for the same date replaces it.
_Avoid_: Weigh-in, measurement

**Latest Body Weight**:
The Body Weight Entry with the most recent date. Every new Set of a Body-weight Movement takes it as its Weight, and the user can't change that number in the Set; anything extra goes in Added Weight.
_Avoid_: Current weight

**Body Weight Snapshot**:
The body weight copied into a Set of a Body-weight Movement when the Set is logged. Later Body Weight Entries do not change it.
_Avoid_: Live body weight

**Added Weight**:
Extra weight on a Set of a Body-weight Movement, always with a short description of how it was added. Positive means extra load (a weighted vest, a dip belt); negative means assistance (a resistance band, an assisted machine).
_Avoid_: Extra weight, assistance weight

**Load**:
The total weight moved in one rep of a Set. For a Body-weight Movement it is the Body Weight Snapshot plus the Added Weight. For any other Movement it is the Weight.
_Avoid_: Effective weight, total weight

### Progress

**Training Day**:
The calendar date, in the user's local time zone, on which a Workout was completed. Two Workouts completed on the same date count toward the same Training Day.
_Avoid_: Workout date, session date

**Progression Chart**:
A chart of one Metric for one Movement, with one point per Training Day.
_Avoid_: Progress graph, stats

**Metric**:
A number computed from a Movement's Sets on a Training Day. There are three: Max Weight, Total Reps, and Total Volume.

**Max Weight**:
The highest Load of any Set of the Movement on a Training Day.
_Avoid_: PR, top set, 1RM

**Total Reps**:
The sum of Reps across all Sets of the Movement on a Training Day.

**Volume**:
The Load of a Set multiplied by its Reps.
_Avoid_: Tonnage, work

**Total Volume**:
The sum of Volume across all Sets of the Movement on a Training Day.

**Body Weight Chart**:
A chart of the user's Body Weight Entries over time, one point per date.
_Avoid_: Weight history graph
