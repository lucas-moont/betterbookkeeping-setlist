# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who lift weights. They open Setlist in two situations, and both matter equally:

- **At the gym, phone in hand.** Between sets they log what they just did (movement, weight, reps). Hands are busy, rest is short, attention is split. Logging a set has to take seconds.
- **Away from the gym, on a laptop or a phone.** They manage their movement library, record their body weight, and review their history and progress with more time and attention.

A second audience reads the product too: Setlist is a take-home assignment for a job application, and a reviewer will open the app, read the code, and judge how each feature was built and why.

## Product Purpose

Setlist is a no-nonsense strength training log. A lifter records what they lift, set by set, and the app shows whether they are getting stronger.

The first version covers logging: accounts, a personal movement library, a current workout with sets, and a history of completed workouts. The current milestone is about **progress**: body weight tracking with a chart, body-weight movements whose sets take the lifter's latest body weight, and progression charts per movement and metric.

Success means a lifter can log a workout without friction and can see, at a glance, whether their numbers are going up.

## Positioning

A log, not a coach. Setlist records what the lifter did and shows the trend; it doesn't prescribe programs, gamify training, or judge.

## Operating Context

- A workout is one session at the gym. A user has at most one Current Workout; sets are added to it as the session goes, then the workout is completed and moves to history.
- Body weight is recorded on its own, usually once a day or less, and feeds every new set of a Body-weight Movement.
- Progress is read per Training Day (the local calendar date a workout was completed), not per workout.
- The reviewer of the take-home runs the app locally with `bun run dev` and reads the PRs, ADRs (`docs/adr/`), and README.

## Capabilities and Constraints

- **Terminology:** `CONTEXT.md` is the domain glossary and binds UI copy: "Movement", "Set", "Load", "Body Weight Entry", "Gym Visit", "Training Day", and so on. Use its terms and avoid the ones it lists under _Avoid_.
- **Units:** every weight is in pounds, with decimals allowed (ADR 0002).
- **Ownership:** each user sees only their own movements, workouts, and body weight (ADR 0001).
- **Language:** the UI is in English.
- **Stack:** TanStack Start (React SSR), Tailwind CSS v4, `lucide-react` icons, small hand-rolled primitives in `src/components/ui/`.
- **Scope:** a take-home with a delivery deadline. Prefer the lean, sensible solution over a complete or enterprise one.
- **Open:** the mobile navigation pattern (bottom bar or collapsible menu) is not decided yet; the responsive-layout work decides it.

## Brand Commitments

- The visual identity came with the assignment and stays: its color, type, and styling remain consistent with the existing screens, however simple they are. No redesign. Creative ideas are welcome as suggestions, but speed of delivery comes first.
- Name: **Setlist**, with the wordmark in `public/wordmark.svg`.

## Evidence on Hand

- `README.md`: the product description and the assignment.
- `CONTEXT.md`: the domain glossary.
- `docs/adr/`: decisions on ownership, weights, body-weight snapshots, progression queries, passwords, sessions, workout constraints, tests, and code layout.
- `docs/research/empty-workouts.md`: research behind the Gym Visit choice.
- No real user data, testimonials, or metrics exist. Prototypes use labeled sample data.

## Product Principles

1. **Logging comes first.** Anything on the workout screen that slows down recording a set is a cost.
2. **Show the trend, honestly.** Charts plot real Training Days on a real time axis; a gap in training shows as a gap.
3. **The lifter decides.** When data could be lost or created silently (an empty workout, a replaced entry), ask instead of assuming.
4. **One vocabulary.** The words in the UI are the words in `CONTEXT.md`.
5. **Fit the existing app.** New screens look like they were always there.
