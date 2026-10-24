---
version: 1
slug: "app-pages-index-vue"
primary_target: "app/pages/index.vue"
related_targets: ["app/layouts/default.vue","app/assets/css/tokens.css"]
---

# Dashboard (Overzicht) surface brief

Mode: Operate. Target: app/pages/index.vue, with app/layouts/default.vue and app/assets/css/tokens.css (system-wide reskin).

Audience/job: skater or parent on a phone, rink-side or in the car, right after a race: "how did it go against my PR?" Secondary: desk review in the evening.
Constraints: Dutch copy; light/dark/system; front-end only; AA contrast; 44px touch targets.

## Direction contract

THESIS: The dashboard is a result sheet read off the ice: the latest race owns the first viewport and everything else is a ruled list under it. Refuses the activity-counts hero, the glow/grid/gradient crypto skin and the all-cards stack.

OWN-WORLD: The ice sheet drawn as a plan. Cool ice-white ground (night-ice navy in dark), ink-navy type, one accent: lane blue for every action and link. Gold marks a record (PR) and nothing else. White and red stay reserved for inner/outer lane dots. Hairline rules like painted lane lines; cards only for the hero and notices. Barlow Semi Condensed for headings and all times (tabular), Inter for running text. No glow, no gradient text, no blur.

STORY: The skater sees race name, venue, date and each distance with finish time and gap to PR within one glance; sees whether a record fell; then best times, then development per distance; counts become one quiet line. They always know OSTA data is being checked, and nothing changes without an undo.

FIRST VIEWPORT: Phone 390px: slim top bar, page title row with OSTA status at the right, then the hero "Laatste wedstrijd": name large, venue and date beneath, then one row per race: distance left, finish time large (display face), gap to PR right with arrow and sign, gold PR marker. Bottom tab bar fixed. Desktop: sidebar left, hero spans the main column with best times beside it.

FORM: Candidate 3 of my grounded list (1 rink timing board, 2 KNSB paired-lane start sheet, 3 ice sheet as a plan, 4 Elfstedentocht stamp card, 5 coach's lap notebook, 6 Omega results booklet, 7 blade trace on ice). Seed key 99e77c91. Challengers weighed: split-flap concourse (competitive; raise: columns never move, fixed numeric cells), midnight transit diagram (competitive; raise: stations along a line = laps in order), vertical video feed (declined; raise: one item owns the first viewport), acetate manual (declined; raise: one body size, short measure), catalog sleeve (declined; raise: vast quiet ground, one plot owns the field), star atlas (declined; raise: record points ringed on the sparkline).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
