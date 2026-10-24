# Features of the old SkateStats that are missing in SkateStats-Nuxt

Compared: `remco59/SkateStats` (FastAPI/Jinja, `app/main.py` + `app/templates/*`, at
`01a634c`) against `remco59/SkateStats-Nuxt` (at `aac6d39`). The comparison reads the old
templates and route handlers and the Nuxt pages and API routes. Nothing was run in a browser.

Priority:

- **P1**: lost functionality, a dead end in the UI, or a data-loss risk.
- **P2**: a real feature gap.
- **P3**: polish.

`REBUILD_PLAN.md` is the intended spec. Where an item was promised there but not delivered, it
says so. Where the plan dropped it on purpose, it is listed under "Intentional differences"
at the end, not here.

---

## Status

Each area has its own pull request, branched from `main`. They merge in this order (1 → 9);
the later ones expect small conflicts, listed under "Merge notes".

| Area | Sections | PR |
|---|---|---|
| Navigation, quick-add button, global search, footer | 0.1, 0.4, 9.1, 9.5 | #22 |
| Light / system theme, animation setting, card reveals | 0.2, 7.1, 7.2, 9.3, 9.4 | #23 |
| Targets (manual splits, edit, generate, progress, simulation) | 0.3, 3 | #24 |
| Stats (story, fun stats, lap stats, defaults) | 2 | #25 |
| Race comparison | 4 | #26 |
| Races and competitions (lists, filters, detail, editing) | 5 | #27 |
| Dashboard and OSTA monitor | 1, 7.5 | #28 |
| Import | 6 | #29 |
| Account, admin, CLI | 7.3, 7.4, 7.6, 7.7, 8, 10.1 | #30 |

**Corrections to this list, found while building:**

- **6.7**: the old app had no competition name / venue / date overrides for the PDF import.
  Only the defaulting of the skater name from the account existed, and that is done.
- **6.2 / 6.5**: the old "overwrite" and "add as new" modes are covered by the rebuilt
  dedup rules plus an explicit "Toevoegen als nieuwe wedstrijd" for the case where an
  existing competition only looks the same. The "update same-date competitions with OSTA
  laps" switch stays a per-race correction choice.
- **6.8**: the blacklist overview shows readable races and has bulk removal, but not the
  old PID / race-count columns: signatures no longer contain a PID and a count would need a
  schema change.
- **10.2** (admin created automatically on startup) was left as it is, by design: the plan
  chose the CLI, and `bootstrap-admin.ts` sets the password in one step.
- **8.5**: both guards now apply: you cannot remove your own admin rights *and* the last
  admin cannot be demoted or deleted.

**Merge notes.** Merged in order, these conflict by hand in a handful of places, all small:
`progress/targets.vue` (tab line from #22 vs. width from #24), `CompareChart.vue` (changed in
#23, deleted in #26: delete it), `results/competitions/index.vue` (both sides are wanted),
`reference/fixtures/README.md` (each PR adds a paragraph: keep all), `TrendSparkline.vue`
and `index.vue` (#28 replaces the chart; take #28's), `import/index.vue` and the two OSTA
import routes (#29 supersedes #28's one-line changes), and `account/index.vue` (#30 moves
three sections into components; keep #23's "Weergave" and #28's monitor options). I merged all
nine in that order in a scratch checkout, resolved these, and ran lint, typecheck, the unit
tests (431) and the end-to-end smoke suite on the result; only the PDF-upload step could not
run in my sandbox, as on `main`.

---

## 0. Biggest findings

1. **Targets page and standalone Races list are unreachable from the UI.** The nav has
   Dashboard / Results (`/results/competitions`) / Progress (`/progress/stats`) / Import. No
   link, tab or button leads to `/progress/targets` or `/results/races`. The plan calls for
   Progress sub-tabs (Stats | Targets) and a Results hierarchy. Neither exists. **P1**
2. **No light/system theme and no animation setting.** The schema stores
   `themePreference` and `motionPreference`, and `PATCH /api/account/profile` accepts them.
   But `tokens.css` says "dark mode only", nothing applies the preference, and the account
   page has no controls. The plan lists theme as a feature. **P1**
3. **Manual split targets are stored but never shown.** The backup importer and the v1→v2
   migration both save `target_opening_ms` / `avg_400` / `last_400` / `fade_400` into
   `targets.generatorProfileJson`. `GET /api/progress/targets` ignores that column and
   always recomputes the splits from the target time. A user who migrates keeps the data
   but cannot see it, and re-saving the target loses it. **P1**
4. **Standalone-race entry is buried.** The old FAB offered "Rit toevoegen" from every page.
   In Nuxt a race can only be created from a competition detail page, or from the
   unlinked races list. **P1**

---

## 1. Dashboard (`/`)

| # | Old behaviour | Nuxt | Pri |
|---|---|---|---|
| 1.1 | Trends card has a **season filter**, defaulting to the *current season*. | Always all seasons, no filter. | P2 |
| 1.2 | Sparkline tooltips show distance, time, **race name, date and an "Open rit" link** (hover delay on desktop, tap on touch). It also has month ticks on the x-axis. | ECharts tooltip shows the time only. No name, date or click-through (the plan asks for click-through). No x-axis labels. | P2 |
| 1.3 | Trend with a single point shows "Enige tijd: X op <date>". | Shows "Nog geen trend beschikbaar". | P3 |
| 1.4 | "Laatste wedstrijd" table has an **Opening** column (first lap time) and a PR gap shown only for non-DNF races. | No Opening column. | P3 |
| 1.5 | "Meer statistieken → Bekijk alles" tile linking to stats. | None. | P3 |
| 1.6 | Overview cards: "Favoriete locatie/afstand" are first-class cards. | Present, but small text under the counts. | P3 |
| 1.7 | OSTA detection is a **modal dialog** with a per-competition **"Negeer"** button that blacklists it permanently, plus a one-click **"Importeer alles"** (no preview step). | Banner with "Bekijken" (opens the preview) and "Later". "Later" only hides the banner for this page view (`dismissed = true`), so it returns on every load. There is no per-competition ignore and no one-click import. | P2 |
| 1.8 | OSTA monitor **auto-import mode**. New competitions import silently and the dashboard shows "OSTA automatisch geïmporteerd: N wedstrijden en M ritten". | The API enum accepts `auto_import`, but the UI only offers `notify` / `off` and `detectOstaUpdatesForUser` never auto-imports. Selecting it via the API would behave like `notify`. | P2 |
| 1.9 | Flash notices after ignore/import (`?osta_notice=…`). | None. | P3 |

---

## 2. Stats (`/progress/stats`, old `/stats`)

Defaults: the old page defaults the season filter to the *current season*. The Nuxt page
defaults to all seasons (`currentSeason` is computed in `buildStatsContext` but never used).
**P3**

| # | Old section | Nuxt | Pri |
|---|---|---|---|
| 2.1 | **"Coach Analyse" story card**, a random one of three narrative variants (commentary / analysis / recap) built from the "fun stats" below, with links to the races involved and green/red tone. | Missing. The whole `story_variants` feature was not ported. | P2 |
| 2.2 | **Fun stats**: fastest lap (time, distance, venue, race), fastest opening, closest miss of a PR, busiest month, most-skated distance. | Missing. | P2 |
| 2.3 | **Progressie Statistieken** table: first race, latest race (both linked), improvement, average of last 5, season average, trend. | The data is computed (`firstMs`, `latestMs`, `improvementMs`, `last5AvgMs`, `seasonAvgMs`) but the page only renders the trend label. First, latest, improvement, last-5 and season averages are not shown. | P2 |
| 2.4 | **"Tijden per afstand"** cards per distance. PB and SB (labelled with the reference season, e.g. "Seizoensbeste (2025/26)"), average, median. For non-sprint distances (not 100 or 300 m): **average opening, best opening, average lap, best lap, average fade**. Plus a collapsible **per-lap averages** list ("Gem ronde 1…n"). | Per-distance table shows PR, SB, average, median, std-dev, range, trend. No opening, lap, fade or per-lap stats, and no SB reference season. `StatsRaceInput.lapsMs` is available, but no lap aggregation exists. | P2 |
| 2.5 | Track stats shows **best and worst** track relative to average. | Only "Beste baan" is rendered. `worstTrack` is computed but not shown. | P3 |
| 2.6 | "Reset" button for the filters. | None (select back to "Alle"). | P3 |
| 2.7 | Total km, PR count and SB count in basic stats. | Present. | — |

---

## 3. Targets (`/progress/targets`, old `/targets`)

| # | Old behaviour | Nuxt | Pri |
|---|---|---|---|
| 3.1 | **Reachable** from the main nav. | Not linked anywhere (see section 0). | P1 |
| 3.2 | **Editable split targets**: opening, average lap, last lap, fade, saved with the target, plus free-text **notes**. | The API accepts only `distanceM`, `targetTimeMs` and `notes`, and the UI sends only the first two. The split values are always recomputed. Nothing can be set by hand. | P1 |
| 3.3 | **"Genereer targets"** button fills the editable split table from the skater's own history, falling back to default pacing ratios. Also a "Handmatig invullen" mode. | The generator exists server-side, but its output is only shown read-only. | P2 |
| 3.4 | **Edit target** dialog (change time or splits, regenerate). | No edit. You can only re-save the same distance with a new time. | P2 |
| 3.5 | **Voortgang** (progress) block per target: actual best vs target for opening, average lap, last lap and fade, with delta and a green "met goal" state. Gem. ronde is hidden for 500 m. | Missing. `build_goal_progress` was not ported. | P2 |
| 3.6 | **Live split simulation**: an expandable table of per-segment target splits with cumulative times. Editing one split rebalances the following splits so the total stays equal to the target. | Missing. | P2 |
| 3.7 | Confirmation dialog before deleting. | Deletes immediately, no confirm. | P3 |
| 3.8 | Forecast text: "nog X te gaan … rond N ritten … ruwe ETA …", and a green "Target gehaald" chip linking to the best race. | Forecast exists as one short sentence. It does not link to the best race and does not show the remaining delta or improvement per race. | P3 |

---

## 4. Race comparison (`/results/races/[id]/compare`)

The calculation core is ported (`server/utils/compare.ts`) and golden-tested. The
presentation is much thinner.

| # | Old | Nuxt | Pri |
|---|---|---|---|
| 4.1 | **Narrative summary** ("Waar werd tijd gewonnen of verloren? …", e.g. "Snellere opening, maar veel verval in de slotfase."). | Explicitly **not ported** (see the header of `compare.ts`). | P2 |
| 4.2 | **Split-delta chart** (time difference per split). | Missing. Only a cumulative chart exists. | P2 |
| 4.3 | **Lap overlay chart**, base and comparison laps on one axis with a legend. | Missing. | P2 |
| 4.4 | **Ritcontext** card: both races side by side with date, venue, opponent and start lane. | Not shown. | P2 |
| 4.5 | **Highlights**: total / opening / final-lap / fade deltas as four tiles. | Rendered as a summary table, which is fine. | — |
| 4.6 | **Ritopbouw** block: opening, final lap and fade for both races, plus pacing-label chips. | Pacing labels as plain text only. | P3 |
| 4.7 | **Picker dialog** with search, venue and date-range filters and a reset. | A plain `<select>` of all same-distance races. | P3 |
| 4.8 | **"Wissel basis en vergelijking"** (swap) button, and "Terug naar basisrit". | Missing. | P3 |
| 4.9 | Split table shows the **400m-equivalent** pair (base / compare). | Not shown. | P3 |
| 4.10 | Strongest/weakest split highlighted as tiles with "Split N, distance, delta". | Highlighted as row backgrounds only. | P3 |

---

## 5. Races & competitions: lists and detail

| # | Old | Nuxt | Pri |
|---|---|---|---|
| 5.1 | Races list (**"Ritten"**) is a main nav item. | Page exists but is not linked (section 0). | P1 |
| 5.2 | Races list filters: **distance, tag, lane/baan, venue, date from/to**, in a collapsible Filters panel, plus Reset. | UI exposes only free-text search and distance. The API already accepts venue and dates, but the UI doesn't use them. There is no tag or lane filter. | P2 |
| 5.3 | Races list columns: date, distance, time with **PR badge + tag chip + DNF**, lane dot, **venue**, competition link. | Shows distance, competition, status, date and time. No venue, lane or tag. | P3 |
| 5.4 | Competitions list: filter panel with venue and date range, whole row clickable. | Present, with the filters always visible. Row link exists. | — |
| 5.5 | Global **nav search box** ("Zoek wedstrijd of locatie") in the header on desktop and mobile, jumping to the competitions list with `q`. | Missing. The plan lists "search" in the shell. | P2 |
| 5.6 | Race detail shows **"Gem. verval per ronde"** (average fade per segment), alongside average lap and total fade. | Shows average per 400 m and total fade only. | P3 |
| 5.7 | Race detail has a **"Rondetijden" line chart** of the lap times. | Missing (the split table exists). | P2 |
| 5.8 | Race detail text: "Eerste geregistreerde tijd op deze afstand." when there is no earlier PR. | Shows "-". | P3 |
| 5.9 | **Notes rendered with clickable source links.** "Geïmporteerd van OSTA: <url>" becomes a link. URL lines are linkified. | Plain text. Auto-import notes are hidden entirely, and the source is shown as a link under "Technische informatie" instead. This is acceptable, but free-text URLs are not linkified. | P3 |
| 5.10 | Race detail has a **"Nieuwe rit"** button pre-filled with the same competition. | Only available from the competition detail. | P3 |
| 5.11 | Competition detail shows the **notes** and, per race, **average lap and fade** columns. | Notes are not shown. Table shows status, track and time only. | P3 |
| 5.12 | **Edit a race → move it to another competition** (or create a new one inline). | The race edit form and `PATCH /api/results/races/[id]` have no competition field. A race cannot be moved. | P2 |
| 5.13 | Delete dialog with both "Verwijderen" and "Verwijderen + blacklist". | Same, but via `confirm()` + a "…" menu. | — |
| 5.14 | `dd/mm/jjjj` text input with calendar-picker button. | Native `type="date"`. | P3 |

---

## 6. Import

| # | Old | Nuxt | Pri |
|---|---|---|---|
| 6.1 | **Per-race selection** in the preview: three cards (Nieuw / Blacklist / Overlappend), with per-race checkboxes and "Selecteer alles". The preview also shows lane, opponent and DNF. | Preview is per competition, with per-race **update choices** only for correction candidates (skip / replace / keep both). You can't deselect single new races. Lane and opponent aren't shown. | P2 |
| 6.2 | Commit actions for overlapping competitions: **"Importeren (overschrijven)"** vs **"Toevoegen (nieuwe wedstrijd)"**. | Replaced by the plan's dedup rules (skip / replace / keep both per race). Different model, no equivalent "add as new competition". | P3 |
| 6.3 | OSTA form: **PID field** (skip the name search when you know it) and a **season `ALL`** option. | Name + season (start year) only. `ALL` isn't offered. | P2 |
| 6.4 | OSTA multi-match: **select several profiles** with checkboxes and "Selecteer alles", then merge them. | Pick exactly one candidate. | P2 |
| 6.5 | OSTA option **"Bestaande wedstrijden op dezelfde datum updaten met OSTA-rondetijden"**. | Covered by update candidates, not a switch. | P3 |
| 6.6 | SSR form: **Skater ID field** to skip the name lookup. | Name only. | P3 |
| 6.7 | PDF import: optional **competition name / venue / date overrides** for when the parser can't read them. Skater name came from the account. | Skater name is required on every upload (not defaulted from the account). No overrides. | P2 |
| 6.8 | **Blacklist management** lists name, date, PID and race count, with checkboxes, "Selecteer alles" and **"Haal geselecteerde van blacklist"** (bulk). | Two simple lists, remove one at a time. Race entries show the raw identity signature, not a readable race. | P3 |
| 6.9 | Import page has a combined info card, and success/error banners for each source. | Errors only, inline per card. | P3 |
| 6.10 | **Startup consolidation of duplicate competitions** (`deduplicate_competitions`, merges competitions the old importer split because OSTA titles differed). | Dedup exists inside the import pipeline, but nothing consolidates duplicates *already in the data*, and the migration script doesn't. A migrated database keeps its old duplicates. | P2 |

---

## 7. Account (`/account`)

| # | Old | Nuxt | Pri |
|---|---|---|---|
| 7.1 | **Theme** selector: system / dark / light (applied live). | Missing (section 0). | P1 |
| 7.2 | **Animation** selector: all / background only / cards only / none. | Missing. The schema/CSS only know `all` / `reduced`, and nothing applies them. | P2 |
| 7.3 | Change **username** (and skater name) with uniqueness errors ("al in gebruik", "al gekoppeld aan ander account"). | Only skater name is editable. | P2 |
| 7.4 | Password change with **confirmation field** and specific errors (current wrong / too short / mismatch). | No confirmation field. One generic error. | P3 |
| 7.5 | OSTA monitor: **mode `auto` / `notify` / `off`**, a single name + PID + season (incl. `ALL`) form. | Multiple linked profiles (an improvement), but the UI offers `notify` / `off` only (see 1.8). The API rejects any season that isn't a 4-digit year, so `ALL` can't be monitored. | P2 |
| 7.6 | **Delete account** requires typing your username in a modal. | A single checkbox. | P3 |
| 7.7 | Flash banners for each action (profile saved, backup restored: N competitions / races / targets). | Inline messages for most. Profile save says "Opgeslagen." | — |
| 7.8 | Backup import limit 20 MB with a clear error. | Same limit. | — |

---

## 8. Admin (`/admin/users`)

| # | Old | Nuxt | Pri |
|---|---|---|---|
| 8.1 | **Search/filter** the user list by name or username. | Missing. | P3 |
| 8.2 | Create user with a **confirm-password** field and specific errors (length, mismatch, duplicate username, duplicate skater name). | Single password field, generic error. | P3 |
| 8.3 | **Delete user requires typing the username** in a modal. | **Deletes immediately on click, no confirmation at all.** | P1 (safety) |
| 8.4 | Reset password via a form with a confirm field. | Browser `prompt()`. | P3 |
| 8.5 | "You can't remove your own admin rights" guard. | Last-admin protection exists instead (stricter in one way, looser in another). | — |
| 8.6 | — | New in Nuxt: `/admin/system` "update & restart". | n/a |

---

## 9. Shell and global UI

| # | Old | Nuxt | Pri |
|---|---|---|---|
| 9.1 | **Floating action button** with quick actions: Importeren / Wedstrijd toevoegen / Rit toevoegen. The plan lists it. | Missing. Adding a standalone race now needs the orphaned races list (see section 0). | P1 |
| 9.2 | **Profile menu** dropdown (settings, admin, logout) in the header. | Replaced by a sidebar footer, which is fine. | — |
| 9.3 | Staggered card **reveal animations** and animated background, governed by the motion setting. | Static. | P3 |
| 9.4 | Light mode and system mode (see 7.1). | Dark only. | P1 |
| 9.5 | Footer ("Gemaakt met ♥ door Remco Land"). | None. | P3 |

---

## 10. Operations and CLI

| # | Old | Nuxt | Pri |
|---|---|---|---|
| 10.1 | CLI `list-users`, `create-user <user> "<Skater>" [--admin]`, `set-password <user>`. | One script, `bootstrap-admin.ts`, which creates or resets a single user. There is no `list-users`, and creating a non-admin user from the shell isn't possible. | P3 |
| 10.2 | Admin user created automatically on startup from `SKATESTATS_ADMIN_USERNAME`. | Needs a manual `bootstrap-admin` run (the plan's open question 3). | P3 |
| 10.3 | `/health` alias. | `/api/health` only, on purpose. | — |

---

## Notes

**Not live in the old app either.** `_notification_center.html` and
`build_notification_center_context` exist (new data / PRs / SBs in the last 30 days /
streaks), but `home()` never passes that context and no template includes the partial.
So it was effectively dead code. The Nuxt dashboard has a simplified version
(recent PRs / SBs and a streak tag), which is more than the old app showed.

**Intentional differences** (from `REBUILD_PLAN.md`, not gaps):

- Navigation is merged into Dashboard / Results / Progress / Import / Account (but see
  section 0: the second level isn't wired up).
- Boolean `dnf` became a `status` enum.
- "Buitenijs" became a structured `trackType`.
- `laps_csv` became a structured laps table.
- A single OSTA profile became a list of linked profiles.
- Import dedup was redone (skip / replace / keep both) in place of "overwrite / add".
- `/health` became `/api/health`.
- Password hashing moved to scrypt, with lazy upgrade of old pbkdf2 hashes.
- Charts are drawn with ECharts / SVG components instead of server-built SVG coordinates.

**Covered with parity** (checked, no action): login with `next` redirect, session
invalidation on password change, competition CRUD and "delete + blacklist", race CRUD with
all fields (more than before), PR/SB logic and badges, split/pace math (golden-tested), OSTA
/ SSR / PDF parsing, backup export/import in the old format, 20 MB upload caps, last-admin
protection.
