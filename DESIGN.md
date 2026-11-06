---
name: Setlist
description: A no-nonsense strength training log.
colors:
  chalk-rust: "oklch(55% 0.2 35)"
  page-ground: "#f8fafc"
  surface: "#ffffff"
  hover-wash: "#f1f5f9"
  hairline: "#e2e8f0"
  field-border: "#d1d5db"
  ink: "#0f172a"
  ink-soft: "#475569"
  ink-muted: "#64748b"
  ink-faint: "#94a3b8"
  field-label: "#374151"
  danger: "#dc2626"
  danger-wash: "#fef2f2"
  danger-line: "#fecaca"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  caption:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.chalk-rust}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.field-label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.field-label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
  list-row:
    backgroundColor: "{colors.page-ground}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.hover-wash}"
    textColor: "{colors.ink}"
---

# Design System: Setlist

## Overview

**Creative North Star: "The Training Notebook"**

Setlist looks like a clean training notebook: a pale page, white cards laid on it, and the numbers of each set written plainly. Nothing decorates the work. The lifter's data is the content, and the interface stays out of its way.

The system is small and came with the assignment: Tailwind's slate neutrals, the system sans-serif, white cards with a hairline border and the faintest shadow, and one brand color, Chalk Rust, used for the main action and the logo. Components are plain and dependable: gently rounded corners, minimal shadow, no effects. They feel like a tool, not a showcase. New screens extend this world; they don't reinvent it.

Density is moderate. Pages are a stack of cards with 24px between them, inside a white sidebar layout on desktop.

**Key Characteristics:**

- One accent (Chalk Rust) on a cool slate-and-white ground
- System sans-serif, two weights doing most of the work (500 and 600)
- Flat white cards with a 1px hairline and `shadow-sm`
- Rows inside cards sit on a pale slate fill, not on dividers
- `lucide-react` line icons at 16px beside labels

## Colors

A restrained palette: cool slate neutrals plus one warm accent.

### Primary

- **Chalk Rust** (`oklch(55% 0.2 35)`, about `#cc2d00`): the primary button fill, links, the focus ring (at 50% opacity), the selected-row tint in tables (at 10% opacity), and the wordmark tile. It is the same color as the logo in `public/wordmark.svg`.

### Neutral

- **Page Ground** (`#f8fafc`, slate-50): the app background behind every card, and the fill of list rows inside cards.
- **Surface** (`#ffffff`): cards, the sidebar, inputs, outline buttons.
- **Hover Wash** (`#f1f5f9`, slate-100): hover and active state of sidebar items.
- **Hairline** (`#e2e8f0`, slate-200): the sidebar's right border, table header rule, card borders.
- **Field Border** (`#d1d5db`, gray-300): inputs, selects, outline buttons, checkboxes.
- **Ink** (`#0f172a`, slate-900): page titles and primary text.
- **Ink Soft** (`#475569`, slate-600): nav labels, table headers and numeric cells.
- **Ink Muted** (`#64748b`, slate-500): secondary text, empty-state messages, the reps × weight detail in a set row.
- **Ink Faint** (`#94a3b8`, slate-400): small captions ("Logged in as"), icon-only remove buttons, placeholder dashes.
- **Field Label** (`#374151`, gray-700): form labels and outline/ghost button text.

### Status

- **Danger** (`#dc2626`), **Danger Wash** (`#fef2f2`), **Danger Line** (`#fecaca`): the destructive button and inline form errors. The `Alert` primitive also carries amber (warning) and emerald (success) variants.

### Named Rules

**The One Accent Rule.** Chalk Rust is the only saturated color on a normal screen. It marks the primary action, the focus ring, and selection; it never fills a card, a header, or a background region.

**The Two Grays Rule.** The layout and pages use slate; the form primitives (`button`, `input`, `select`) use gray. This split is the incumbent state. Keep each primitive on the gray it already uses, and use slate for everything new outside those primitives.

## Typography

**Font:** the system sans-serif stack (`ui-sans-serif, system-ui, sans-serif`), Tailwind's default. No web font is loaded.

**Character:** neutral and native. The type reads as the operating system's own, which keeps the app feeling like a utility.

### Hierarchy

- **Headline** (600, 1.5rem / 2rem, `text-2xl font-semibold text-slate-900`): one page title per screen, top left ("Current Workout", "Workout History").
- **Title** (600, 1.125rem, line-height 1, tracking -0.025em, `CardTitle`): the heading inside a card, such as the workout date.
- **Body** (400, 0.875rem / 1.25rem, `text-sm`): almost all content: rows, table cells, messages.
- **Label** (500, 0.875rem, `text-sm font-medium`): nav items, form labels, button text, the movement name in a set row.
- **Caption** (400, 0.75rem, `text-xs`): tiny supporting text, like "Logged in as".

### Named Rules

**The Small Body Rule.** Body copy is 14px (`text-sm`). Hierarchy comes from weight (500/600) and color (ink vs. muted), not from more sizes.

## Layout

- **Desktop shell:** a full-height flex row. The sidebar is 256px wide (`w-64`), white, with `p-4` and a right hairline; the wordmark sits on top (24px tall, 32px below it), nav items in the middle, and the user block plus "Log out" at the bottom above a hairline. The main area has `p-6` on the Page Ground.
- **Page rhythm:** each page is a vertical stack with 24px gaps (`space-y-6`): the headline row (title left, page action right) and then one or more cards.
- **Inside cards:** 24px padding (`p-6`, content `pt-0` under a header), 16px between blocks (`space-y-4`), 8px between list rows (`space-y-2`).
- **Inline forms:** a single row with 8px gaps (`flex gap-2`), number fields fixed at 96px (`w-24`).
- **Auth screens:** a centered card, max 448px (`max-w-md`), on a slate-50 to slate-100 gradient.
- **Responsive:** not designed yet. The sidebar is fixed width and forms don't wrap; the mobile layout is an open decision.

## Elevation & Depth

Nearly flat. Depth comes from white cards on a pale ground, a 1px border, and Tailwind's `shadow-sm` (`0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`). The primary and destructive buttons carry the same `shadow-sm`. Nothing lifts on hover.

### Named Rules

**The Flat Card Rule.** One elevation level exists: the card. Don't stack shadows, add hover lifts, or introduce a second, deeper shadow for new surfaces. A dialog may sit above the page with a scrim, but its panel is still a card.

## Shapes

Gently rounded everywhere, in three steps: 8px (`rounded-lg`) for buttons, inputs, selects, list rows, nav items and alerts; 12px (`rounded-xl`) for cards; 4px (`rounded`) for checkboxes. Full circles (`rounded-full`) appear only for icon badges, such as the error page's warning circle. Borders are always 1px.

## Components

### Buttons

Plain and dependable.

- **Shape:** gently rounded (8px), 40px tall (`h-10 px-4`); `sm` is 32px (`h-8 px-3`), `lg` is 48px (`h-12 px-6 text-lg`), `icon` is 40×40.
- **Primary:** Chalk Rust fill, white 500-weight text, `shadow-sm`. Hover drops to 90% opacity.
- **Outline:** white with a gray-300 border and gray-700 text; hover gray-50 fill and gray-400 border. Used for secondary page actions such as "Complete Workout".
- **Ghost:** no fill, gray-700 text, gray-100 on hover. Used for "Log out" and icon-only remove buttons (with slate-400 icons).
- **Destructive:** red-600 fill, white text, red-700 on hover.
- **Focus:** a 2px Chalk Rust ring at 50% opacity with a 2px offset. Disabled is 50% opacity.
- **Icons:** a 16px lucide icon before the label, 8px gap.

### Cards

- **Corner Style:** 12px.
- **Background:** white, 1px hairline border, `shadow-sm`.
- **Internal Padding:** 24px; the header stacks with 6px gaps and the content starts flush under it.
- **Empty state:** centered text in Ink Muted with 48px vertical padding (`py-12`) and the primary action below.

### Inputs and Selects

- **Style:** 40px tall, white, 1px gray-300 border, 8px radius, 14px text, gray-400 placeholder. Selects are native `<select>` elements with the same box.
- **Focus:** the border turns Chalk Rust and a 2px Chalk Rust ring at 50% opacity appears.
- **Disabled:** 50% opacity on a gray-50 fill.
- **Labels:** 14px 500-weight gray-700 above the field (auth forms) or an `aria-label` when the form is a single inline row.

### List Rows

- **Style:** Page Ground fill, 8px radius, `px-3 py-2`, 14px text, laid out as name on the left (500 weight, Ink) with detail next to it in Ink Muted, and a ghost icon button on the right.
- Used for sets in the Current Workout and for movements.

### Tables

- Workout History uses a full-width 14px table: header cells in 500-weight Ink Soft over a hairline, body rows separated by slate-100 lines, hover on slate-50, and the selected row tinted with Chalk Rust at 10%.

### Navigation

- **Sidebar items:** 16px icon plus 14px 500-weight label, `px-3 py-2`, 8px radius, Ink Soft. Hover and active both use the Hover Wash fill with Ink text.
- **User block:** a lucide `User` icon with "Logged in as" in caption size and the user's name in 500 weight.

## Do's and Don'ts

### Do:

- **Do** build new screens from `src/components/ui/` (Button, Card, Input, Select, Alert) before writing new markup.
- **Do** open every page with a `text-2xl font-semibold text-slate-900` headline and put its main action at the right of the same row.
- **Do** put content in white cards on the slate-50 ground, and put repeated items inside a card as slate-50 rows with 8px gaps.
- **Do** use Chalk Rust only for the primary action, links, focus, selection, and data that needs one highlight color.
- **Do** use `lucide-react` icons at 16px (`w-4 h-4`) beside text.
- **Do** write UI copy with the terms in `CONTEXT.md` and show weights in pounds.

### Don't:

- **Don't** introduce a new font, a second accent color, gradients inside the app, or dark surfaces.
- **Don't** add shadows deeper than `shadow-sm` or hover lifts.
- **Don't** change the radius steps (8px controls, 12px cards).
- **Don't** fill a card, header, or page region with Chalk Rust.
