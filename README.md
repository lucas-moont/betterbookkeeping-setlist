# Setlist UI prototypes

Throwaway HTML prototypes used to decide the layout and flow of the new screens before building them. They are **not production code**. The app lives on `main`; this branch only keeps the prototypes as a record of what was compared and what was approved.

Each prototype is a single `index.html` with Tailwind and lucide loaded from a CDN, sample data in memory, and a dark prototype bar at the bottom. Through the bar you switch variants, pages and the desktop/mobile view. Arrow keys switch variants too. Nothing is saved.

## How to open

- **Locally:** download or check out this branch and open any `index.html` in a browser.
- **Online:** GitHub doesn't render HTML, so open the file through [raw.githack.com](https://raw.githack.com/), using a commit SHA of this branch:
  `https://raw.githack.com/lucas-moont/betterbookkeeping-setlist/<commit>/<folder>/index.html`

URL parameters: `?variant=A|B|C` (where a prototype has variants), `?view=desktop|mobile|both`, `?page=...` (in the last two).

## Prototypes

| Folder | Question | Approved | Open with |
|---|---|---|---|
| [`profile-body-weight/`](profile-body-weight/) | Profile page with a Body Weight section: record an entry, see the chart and the list | **A** | `?variant=A` |
| [`progression-chart/`](progression-chart/) | Progression chart in Workout History: pick a movement and a metric. It also marks breaks longer than two weeks. | **C**, movement list beside the chart, plus search | `?variant=C` |
| [`body-weight-sets/`](body-weight-sets/) | Set form for body-weight movements: locked body weight plus an optional added weight with a description | **A** | `?variant=A` |
| [`empty-workout/`](empty-workout/) | Completing a workout with no sets: save it as a gym visit, discard it, or keep logging | **A** | `?variant=A` |
| [`responsive-layout/`](responsive-layout/) | Navigation and layout on a 375 px phone | **A**, bottom tab bar with Log out as the fifth item | `?variant=A` |
| [`sets-and-muscle-groups/`](sets-and-muscle-groups/) | Marking each set as completed, adding several sets at once, and a muscle group on each movement | The file shows only the approved design | no parameter |

### What the last prototype settled

- **Sets:**
  - Adding a set logs it as completed, as the README describes.
  - The circle on each set unmarks a set that wasn't done.
  - A "× sets" field adds several identical sets at once.
  - The list is grouped by movement, with "1 of 3 completed".
- **Muscle groups:**
  - Each movement has one muscle group: Chest, Back, Shoulders, Arms, Legs, Abs or Lower Back.
  - You set it on the Movements page, which has a filter by group.
  - A workout's muscle groups come from its completed sets, and nobody picks them by hand.
- **Discarded on the way:**
  - "Log set" and "Plan set" buttons
  - a "Completed" checkbox in the form
  - choosing muscle groups per workout

## Research

[`research/planned-sets-labels.md`](research/planned-sets-labels.md) shows how other strength apps (Strong, Hevy, JEFIT, Fitbod, Boostcamp, StrongLifts, Liftosaur) name logged and planned sets. It also covers touch-friendly help patterns and the guidelines for button labels, with sources.

## Screenshots

Each folder has a `shots/` folder with the screenshots taken while checking the prototype: desktop and 375 px mobile, plus the main interactions. Some show variants that were not approved. They are kept as a record of what was compared.
