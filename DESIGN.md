---
name: SkateStats
description: The ice sheet drawn as a plan: ice-white or night-ice ground, ink type, one lane-blue accent, gold for records only.
colors:
  lane-blue: "#0b57c4"
  lane-blue-deep: "#083f93"
  lane-blue-night: "#6db0ff"
  lane-blue-night-light: "#9ccaff"
  record-gold: "#7a4f00"
  record-gold-night: "#f0b429"
  ice-bg: "#edf2f6"
  ice-surface: "#ffffff"
  ice-surface-2: "#e4ebf1"
  ice-surface-3: "#d6e0e9"
  ink: "#0c1a29"
  ink-muted: "#3a4f63"
  ink-faint: "#4f6478"
  night-bg: "#09111a"
  night-surface: "#0f1a25"
  night-surface-2: "#15232f"
  night-surface-3: "#1c2d3c"
  night-ink: "#eaf1f7"
  night-ink-muted: "#a9bccd"
  night-ink-faint: "#8fa4b8"
  better: "#12703a"
  better-night: "#4cd08a"
  worse: "#b42318"
  worse-night: "#ff7b72"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, Segoe UI, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0"
  headline:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
  data:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "'tnum' 1, 'lnum' 1"
  body:
    fontFamily: "Inter, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.lane-blue}"
    textColor: "{colors.ice-surface}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.lane-blue-deep}"
  button-secondary:
    backgroundColor: "{colors.ice-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "40px"
  card:
    backgroundColor: "{colors.ice-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge-pr:
    textColor: "{colors.record-gold}"
    rounded: "{rounded.sm}"
    padding: "1px 7px"
---

# Design System: SkateStats

## Overview

**Creative North Star: "The Ice Sheet as a Plan"**

SkateStats is read like a result sheet off the ice: flat, ruled, and exact. The ground is cool ice-white by day and night-ice navy after dark, type is ink-navy, and the only accent is lane blue, the colour of the lines painted on the sheet. Surfaces are flat with hairline edges; nothing glows, blurs or floats at rest. The lead card of a page carries two parallel lane lines along its top edge, which are laid down left to right once when the page opens.

Times are the content. Every time, distance and count is set in a condensed timing-board sans with tabular figures, so columns of results line up and a skater can compare numbers at a glance on a phone. Running text is Inter at 16px.

**Key Characteristics:**
- Flat and ruled: hairline borders, no shadows at rest, no gradients, no blur.
- One accent (lane blue) for every action, link and focus; gold marks a record and nothing else.
- Times and distances in the data face with tabular figures.
- Phone first: bottom tab bar, 44px touch targets, the latest result before anything else.
- Light, dark and system themes are each composed, not inverted.

## Colors

Cool ice neutrals with one blue accent; gold is reserved for records.

### Primary
- **Lane Blue** (#0b57c4 light / #6db0ff night): actions, links, active navigation, focus rings, the chart line. White on Lane Blue is 6.6:1; night ink on night Lane Blue is 8.4:1.

### Secondary
- **Record Gold** (#7a4f00 light / #f0b429 night): the PR badge and the PR streak tag only. Never decoration.

### Neutral
- **Ice** (#edf2f6) / **Night Ice** (#09111a): page ground.
- **Surface** (#ffffff / #0f1a25), **Surface 2** (#e4ebf1 / #15232f), **Surface 3** (#d6e0e9 / #1c2d3c): cards, controls, hover steps.
- **Ink** (#0c1a29 / #eaf1f7), **Ink Muted** (#3a4f63 / #a9bccd), **Ink Faint** (#4f6478 / #8fa4b8): text steps; faint text keeps at least 4.5:1 on every surface step.
- **Better / Worse** (#12703a / #b42318 light, #4cd08a / #ff7b72 night): time deltas, always paired with a sign or arrow.
- White and red dots remain reserved for inner and outer lane (LaneDot).

### Named Rules
**The One Voice Rule.** Lane blue is the only accent. If something is blue it can be pressed or it is where you are.
**The Gold Means Record Rule.** Gold appears only on a PR. A gold element that is not a record is a bug.

## Typography

**Display / Data Font:** Barlow Semi Condensed (700/600/500), self-hosted, SIL OFL.
**Body Font:** Inter (400-700), self-hosted.

**Character:** A condensed timing-board sans for headings and every number, a neutral grotesque for sentences. No third-party font requests.

### Hierarchy
- **Display** (700, 1.75rem, 1.1): page titles, the lead card's competition name.
- **Data lead** (700, 2rem, 1.1, tabular): finish times on the lead card.
- **Headline** (600, 1.25rem, 1.2): section titles.
- **Title** (600, 1.125rem): card titles, best-time distances.
- **Body** (400, 1rem, 1.6): sentences, 60ch max on prose.
- **Label** (500, 0.8125rem): column heads, metadata, legends. Nothing is set below 13px except the 12px-equivalent SVG ticks.

### Named Rules
**The Tabular Rule.** Any figure that can be compared with another uses the data face with tabular, lining numerals (`.font-mono`, the class name is historic).

## Layout

Operate surface, predictable structure. Desktop: a 252px sticky sidebar and a main column up to 72rem. The dashboard lead card and best times sit side by side (3fr / 2fr) from 1024px; below that everything stacks in the order result, best times, new OSTA data, development, totals. Phone: slim top bar (brand, menu), fixed 60px bottom tab bar with the four destinations, quick-add button floating above it. Spacing follows a 4px base (4, 8, 12, 16, 24, 32); more space above a section than below its heading. Totals are one quiet line at the bottom, not a hero.

## Elevation & Depth

Flat by default: depth comes from surface steps and hairlines. Only floating things lift (menus, tooltips, the quick-add button): `0 10px 24px -8px` at 28% ink in light, 60% black in night. No glow, no blur, no gradient.

## Shapes

Crisp: 4px for badges, 8px for controls, 12px for cards, pills for chips and the quick-add button. The brand mark is the ice oval (a stadium shape with an inner lane).

## Components

### Buttons
- **Shape:** 8px radius, 40px high (44px on touch), semibold Inter 15px.
- **Primary:** Lane Blue fill, accent-contrast text; hover darkens to Lane Blue Deep (lightens at night). One primary per region.
- **Secondary / Ghost:** surface fill or transparent with a strong hairline; hover steps the surface.
- **Focus:** 2px lane-blue outline, 2px offset, on every control.

### Lead card
- **Corner Style:** 12px. Two 2px lane lines along the top edge (7px band), drawn left to right in 720ms once when motion allows. Used once per page.

### Result rows
- Distance, finish time (data lead) with PR badge and opening split beneath, and the gap to the previous PR right-aligned with an explicit sign (−0.20 faster in green, +0.20 slower in red, with spoken text for screen readers). Whole row is a link.

### Badges and chips
- **PR badge:** gold text, gold 14% tint, gold 55% hairline, 13px uppercase data face, `<abbr title="Persoonlijk record">`. **SB badge:** neutral. Chips are pills, 32px (44px on touch).

### Inputs / Fields
- **Style:** 8px radius, strong hairline, surface fill, 16px text. **Focus:** accent border plus 2px outline. Placeholder uses faint ink at 4.5:1 or better.

### Navigation
- **Sidebar:** Inter 15px, active item tinted with a 3px lane tick on the left. **Tab bar:** icon over 12px label, the active tab gets a lane line on the bar's top edge and bold accent text. Both use `aria-current`.

### Sparkline
- Accent polyline, hollow 9px dots with a 44px invisible hit area, keyboard focusable with `role="link"`; tooltip lifts with the float shadow.

## Do's and Don'ts

### Do:
- **Do** lead every result view with the latest result and its gap to the PR.
- **Do** use tabular figures for every time, distance and count.
- **Do** pair colour with a sign, arrow or word for every better/worse signal.
- **Do** give risky actions an undo and long checks a visible status.

### Don't:
- **Don't** add glow, blur, gradient text or an ambient background layer.
- **Don't** use gold for anything but a record, or blue for anything that cannot be pressed or is not the current location.
- **Don't** make activity counts the headline; they are context.
- **Don't** use emoji as icons; draw them in the 1.7px stroke family used by the navigation icons.
- **Don't** nest cards or wrap every list in a card; rules and spacing group first.

## Open decisions

- The `background` motion preference is kept for saved accounts but no longer has an ambient layer to toggle.
