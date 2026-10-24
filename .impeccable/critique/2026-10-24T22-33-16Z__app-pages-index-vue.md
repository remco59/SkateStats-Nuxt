---
target: dashboard (app/pages/index.vue)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:/home/user/SkateStats-Nuxt/app/pages/index.vue"
target_fingerprint: "sha256:d18659ab61c0099b930db4820ea2f0c02bfa1f65c9540fe9048d736397e5d367"
target_path: /home/user/SkateStats-Nuxt/app/pages/index.vue
timestamp: 2026-10-24T22-33-16Z
slug: app-pages-index-vue
closed: true
---
# Critique: dashboard (app/pages/index.vue + layout + tokens)

Method: DEGRADED single-context (sub-agents not permitted by harness). No browser inspection (app not runnable: no node_modules/DB/login). Detector: 0 findings on 4 markup files; tokens.css not scannable.

## Design Health Score: 24/40 (Acceptable)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | OSTA check silent, banner shifts layout, errors swallowed |
| 2 | Match System / Real World | 3 | PR/SB/T.o.v. PR unexplained |
| 3 | User Control and Freedom | 2 | "Negeer" permanent, no undo; flash not dismissible |
| 4 | Consistency and Standards | 3 | Heading roles inconsistent; accent overloaded |
| 5 | Error Prevention | 2 | One-click blacklist; auto-import on load |
| 6 | Recognition Rather Than Recall | 3 | Mobile nav behind hamburger |
| 7 | Flexibility and Efficiency | 3 | Search + FAB; no shortcuts |
| 8 | Aesthetic and Minimalist Design | 2 | Glow/grid/gradient text compete with data |
| 9 | Error Recovery | 2 | Failures give no cause or retry |
| 10 | Help and Documentation | 2 | No PR/SB help; empty first run |

## Design Specificity Verdict
Category-interchangeable: "Bitcoin DeFi" theme (void black, grid overlay, drifting orange glow, gradient wordmark, glow buttons, fire emoji). Only skating nod is `.card-lane-accent`. Possibly a pinned brief; asked the user.

## Priority Issues
- [P1] Primary button + FAB fail contrast: white on #ea580c->#f7931a = 3.56:1 / 2.30:1 (tokens.css:676, QuickActions.vue:119). Use --color-accent-contrast. -> colorize
- [P1] --color-text-faint 3.97:1 on surface (dark mode) styles labels, th, dates, sparkline ticks at 10-12px. -> typeset
- [P1] Inverted hierarchy: activity counts are the hero; latest result + delta to PR is buried; favourites hidden <sm. -> layout
- [P1] Borrowed crypto identity, nothing skating-derived. -> shape, bolder
- [P2] "Negeer" no undo; auto-import on load; banner layout shift; no loading state. -> harden, clarify

## Persona Red Flags
- Casey: 36px menu toggle, ~8px sparkline dots, render-blocking Google Fonts @import.
- Sam: contrast failures, dots lack role, emoji read as "fire", weak input focus.
- Jordan: dashboard of zeros on first run, unexplained PR/SB.

## Minor Observations
Duplicate "PR" badge + delta cell; sub-12px text; uniform cards; `!important` active styles; possible cramped tables at lg.

## Questions to Consider
Biggest number after a race? Visual language from a 400m lap? Does "Negeer" belong on the dashboard?
