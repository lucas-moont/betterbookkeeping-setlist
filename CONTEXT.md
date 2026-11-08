# Setlist

A strength training log. A lifter records what they lift, set by set, and the app shows whether they are getting stronger.

## Language

### Training

**Movement**:
An exercise in a user's own library, such as "Bench Press". Each user owns their movements; nobody else sees or changes them. Names are unique per user, ignoring case.
_Avoid_: Exercise, lift

**Body-weight Movement**:
A Movement where the load is the lifter's own body, such as pull-ups, chin-ups, or dips. The examples lift the whole body, because Load counts the full body weight; a movement that lifts only part of it, such as push-ups, still gets the full body weight if the user flags it (docs/research/body-weight-sets-and-progression.md §8). A user can turn this on or off at any time; the change only affects Sets logged afterwards.
_Avoid_: Calisthenics, bodyweight exercise

**Muscle Group**:
The part of the body a Movement mainly trains, from a fixed list: Chest, Back, Shoulders, Arms, Legs, Abs, Lower Back. "Back" is the upper back; Abs and Lower Back are separate. A Movement has at most one, and may have none.
_Avoid_: Body part, muscle tag

**Workout**:
One training session made of Sets. Its Muscle Groups are those of the Movements of its Completed Sets, never picked by hand, so changing a Movement's Muscle Group changes every Workout that used it.
_Avoid_: Session, training

**Current Workout**:
A Workout that has not been completed yet. A user has at most one. Sets can only be added to or removed from the Current Workout.
_Avoid_: Active workout, open workout

**Completed Workout**:
A Workout the user has marked complete. It is part of the user's history and its Sets no longer change.
_Avoid_: Finished workout, past workout

**Gym Visit**:
A Completed Workout with no Completed Sets, kept because the user chose to record that they went to the gym. It may still hold Planned Sets that were never done. Completing a Current Workout with no Completed Sets always asks whether to save it as a Gym Visit or discard it.
_Avoid_: Empty workout, check-in, attendance

**Set**:
One Movement performed for a number of Reps at a Weight, inside a Workout. A Set is either a Planned Set or a Completed Set.
_Avoid_: Entry, exercise

**Planned Set**:
A Set of a Workout that is not marked completed, because the lifter didn't do it (or hasn't yet). It counts toward nothing until it is completed again, and a Planned Set left in a Completed Workout stays in the history as not done.
_Avoid_: Pending set, todo set

**Completed Set**:
A Set the user has done. Every Set is added completed. Only Completed Sets count toward Metrics, set counts and a Workout's Muscle Groups. While the Workout is the Current Workout, a Set can be switched between completed and planned.
_Avoid_: Done set, finished set, logged set

**Reps**:
How many times the Movement was performed in a Set. Always at least one.
_Avoid_: Repetitions, count

### Weight

**Weight**:
A mass in pounds, with decimals allowed (for example 72.5 lb). Every weight in Setlist uses this unit.
_Avoid_: Kilos, load (when you mean the number typed in a form)

**Body Weight Entry**:
The lifter's body weight on one calendar date. A user has at most one entry per date; recording again for the same date replaces it. The date can't be in the future.
_Avoid_: Weigh-in, measurement

**Latest Body Weight**:
The Body Weight Entry with the most recent date. Every new Set of a Body-weight Movement takes it as its Weight, and the user can't change that number in the Set; anything extra goes in Added Weight.
_Avoid_: Current weight

**Body Weight Snapshot**:
The body weight copied into a Set of a Body-weight Movement each time the Set becomes a Completed Set. Later Body Weight Entries do not change it. A Planned Set has none and shows the Latest Body Weight instead. Whether a Set takes one is fixed when the Set is logged: turning the Movement's flag on or off later doesn't change it.
_Avoid_: Live body weight

**Added Weight**:
Extra weight on a Set of a Body-weight Movement, always with a short description of how it was added. Positive means extra load (a weighted vest, a dip belt); negative means assistance (a resistance band, an assisted machine). Assistance can't exceed the Body Weight Snapshot, so Load is never negative.
_Avoid_: Extra weight, assistance weight

**Load**:
The total weight moved in one rep of a Set. For a Body-weight Movement it is the Body Weight Snapshot plus the Added Weight. For any other Movement it is the Weight. Always rounded to two decimals.
_Avoid_: Effective weight, total weight

### Progress

**Training Day**:
The calendar date, in the user's local time zone, on which a Workout was completed. Two Workouts completed on the same date count toward the same Training Day.
_Avoid_: Workout date, session date

**Progression Chart**:
A chart of one Metric for one Movement, with one point per Training Day.
_Avoid_: Progress graph, stats

**Metric**:
A number computed from a Movement's Completed Sets on a Training Day; Planned Sets never count. There are three: Max Weight, Total Reps, and Total Volume.

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

**Gap**:
15 or more days between two Training Days of a Movement in a row, shown on its Progression Chart as "3 weeks without Bench Press". Missing a single weekly session leaves 14 days, which is not a Gap. An Open Gap runs from the last Training Day to today, once that is 15 days or more. Setlist knows no training plan, so a Gap states the fact and never calls a day missed.
_Avoid_: Missed workout, skipped session

**Body Weight Chart**:
A chart of the user's Body Weight Entries over time, one point per date.
_Avoid_: Weight history graph

### Account

**Session**:
One signed-in browser of a user. It ends 14 to 15 days after the last visit (it is renewed at most once a day), 90 days after sign-in however often it is used, or when the user signs out of that browser. Other browsers stay signed in. Only an account term: a training session is a Workout.
_Avoid_: Login

**Failed Sign-in**:
A sign-in with a wrong password, or with an email that has no account, kept for 15 minutes. After 5 for the same email from the same IP, sign-in is refused until the oldest one is 15 minutes old, even with the right password; a refused sign-in is not a Failed Sign-in. Signing in clears that email and IP's Failed Sign-ins.
_Avoid_: Login attempt
