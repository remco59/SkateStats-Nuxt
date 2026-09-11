# SkateStats v2 — Rebuild Plan (Nuxt)

This document is the single source of truth for rebuilding SkateStats from
scratch on Nuxt. It is written so that a future Claude session can be told
**"execute phase N"** and know exactly what to build, using only this file,
`reference/fixtures/**`, and the pinned commit in section 1 — not by
re-reading whatever `main` has drifted to by then.

The new app is a **separate GitHub repository** (not this one). This repo
(`remco59/skatestats`, the FastAPI/Jinja app) is kept only as a **reference**:
for feature parity, for the portable logic in section 4, and for the golden
calculation fixtures in section 5. Do not build the new app inside this repo.

**Status of this revision**: incorporates a second round of review. The
open items from the previous version (reference pinning, calculation
testing, data model gaps, dedup rules, access control, migration risk,
version pinning) are now resolved as binding decisions in sections 1, 5, 6,
7, and 8. Remaining genuinely open questions are in section 11.

---

## 1. Reference version (binding)

All line numbers, function names, and behavior descriptions in this
document refer to **`app/main.py` at commit
`4dc69595620a268137be4c19f554301e14b8e6da`** (tag this commit
`v1-reference` in this repo before Phase 0 starts, so it survives future
history rewrites). If this repo's `main` moves past that commit before the
rebuild finishes, **the pinned commit remains the reference**, not the
moving `main` — re-derive against the tag, not against whatever is current.

Line numbers will drift the moment anyone touches the old file; treat them
as "look here first", not as a guarantee. Function names are the durable
identifier.

Sample data captured alongside this plan, used as the acceptance-test
inputs for the rebuild (see section 5):

```
reference/fixtures/
  osta/search_results.html      OSTA multi-profile search response shape
  osta/results_list.html        OSTA per-season results-list shape
  osta/race_detail.html         OSTA per-race lap/detail page shape
  ssr/skater_lookup.xml         SpeedSkatingResults XML lookup shape
  ssr/results.json              SpeedSkatingResults JSON results shape
  pdf/sample_sheet.txt          KNSB paired-lane sheet, extracted-text form
  backup/export_sample.json     Account export/backup JSON shape
  calculations/golden_calculations.json   Fixed inputs + real old-app outputs
```

**Important caveat**: the `osta/*` and `ssr/*` fixtures are synthetic —
built by hand to match the exact selectors/endpoints the old app scrapes
(see section 4), not captured from live traffic, because this planning
environment has no network access to those sites. The `calculations/*`
fixture **is** real: it was produced by importing the old app's pure
functions directly and calling them. Before Phase 5/6, replace the
synthetic OSTA/SSR fixtures with real captured responses for an actual
skater profile, and replace `pdf/sample_sheet.txt` with text extracted from
a real PDF result sheet (see section 8's PDF-extraction risk). See
`reference/fixtures/README.md` for exact provenance per file.

---

## 2. Why rebuild, and what "done" means

The current app has grown into one 6,900-line module, HTML-partial
fragments swapped via `fetch()` + `DOMParser` instead of real client
reactivity, and CSS driven by ad-hoc classes. The goal is the same feature
set, a maintainable structure, and a cleaner/modern red-accented design, as
a Nuxt app that still runs as a single Docker container with a SQLite file
on a volume.

"Production state" = every feature in section 3 works, every calculation in
section 5 matches its golden fixture (or has a documented, deliberate
deviation), old data can be migrated (section 9), it runs in Docker with a
health check, and CI is green (lint, typecheck, unit tests incl. golden
fixtures, Docker build).

---

## 3. Full feature inventory

### Auth & accounts
- Session-based login/logout (single-tenant, multi-user).
- Bootstrap admin user on first start.
- Account settings: edit skater profile name, change password, delete own
  account (with confirmation).
- OSTA profile link(s) + monitor preference per account (see section 7 —
  the old single `osta_pid` becomes a list).
- Admin panel: list users, create user (optional admin flag), reset any
  user's password, promote/demote admin, delete user — with the guardrails
  in section 8 (protect the last admin, invalidate sessions on password
  reset/deletion).

### Dashboard
- Empty-state prompt when no data yet.
- OSTA "new data detected" banner, loaded asynchronously.
- Overview cards: number of competitions, number of races, number of PRs,
  favorite venue, favorite distance, link to full stats.
- "Best time per distance" table with a "new PR" badge.
- "Latest competition" card: venue/date, per-race result vs. PR delta.
- Home trends: per-distance sparkline charts with a season filter, hover/tap
  tooltips (race name/date/time), click-through to the race.

### Competitions & races (hierarchical: a competition contains races)
- List with search + filters (see section 5's "search behavior" contract).
- Create / edit / delete a competition; "delete and blacklist" (also
  remembers the signature so future imports won't re-add it).
- Competition detail: metadata + table of races within it.
- Create a race manually; edit / delete; "delete and blacklist".

**Race detail — exact fields shown** (this was underspecified before):
| Field | Notes |
|---|---|
| Distance (m) | e.g. 500 / 1000 / 1500 / 3000 / 5000 / 10000 |
| Result status | Finished / DNF / DNS / DSQ / DQ / WDR / NC — see section 7, this replaces the old boolean `dnf` |
| Total time | formatted `m:ss.hh`, `-` when no time (DNS/DSQ/etc.) |
| **Track type: indoor / outdoor** | structured field, not a free tag (the old app buried this as a manually-applied race *tag*, "Buitenijs" — see section 7) |
| Category / class | e.g. "JA1" — as imported/entered, informational |
| Lane | e.g. "gl"/"bl" (green/blue lane) — also used for de-dup, see section 6 |
| Opponent name | who was in the other lane — also used for de-dup |
| Lap/split times | structured list, each an integer ms value (see section 7 — replaces the old `laps_csv` string) |
| Split table | opening-segment + subsequent segments, each normalized to a "per-400m-equivalent" pace, with delta vs. previous segment (ported math, see section 5) |
| PR / SB badge | shown when this race is the current personal record or was a season best when skated (see section 5's exact PR/SB rule) |
| Delta vs. PR | e.g. "+0.42" or "-0.10", `-` when DNF/no time |
| Tags | free-form situational tags: training / test / important / bad ice / sick / injured / fallen (outdoor removed from this list — it's now the structured track-type field above) |
| Notes | free text, plus structured "imported from OSTA/SSR/PDF: <link>" source notes rendered as clickable links |
| Source | manual / OSTA / SSR / PDF, with a link back to the source when applicable |

- Race compare: pick a second race (same distance) — split-delta chart,
  cumulative-delta chart, lap overlay chart, strongest/weakest segment,
  pacing labels, narrative summary of where time was won/lost.

### Progress (stats + targets)
- Stats: season filter + distance filter; base stats, consistency stats,
  track/venue stats, progression stats, per-distance PR history.
- Targets: set a target time per distance; auto-generated split targets
  (derived pacing profile from the skater's own history for that distance);
  target forecast; progress bars; edit/delete.

### Import
- **OSTA**: search by name → resolve to one or more profile IDs (PID) → on
  multiple matches, let the user pick → fetch season results (HTML scrape)
  → preview → commit or discard.
- **SpeedSkatingResults (SSR)**: look up skater ID via XML API (given +
  family name, handle multiple matches) → fetch season results via JSON API
  (**note**: SSR never returns lap times — only totals, see
  `reference/fixtures/ssr/results.json`) → same preview/commit flow.
- **PDF**: upload a KNSB-style paired-lane result sheet, extract per-skater
  lap/time lines with regex, match the configured skater name, same
  preview/commit flow.
- One shared import pipeline/preview component from the start (see section
  10 — Phase 5 builds this generically, not OSTA-specific, so Phase 6 adds
  SSR/PDF as new *sources* into the same pipeline instead of consolidating
  three separate ones after the fact).
- Blacklist management: view/remove blacklisted competition signatures.
- OSTA monitor: on dashboard load, checks the linked OSTA profile(s) for
  competitions not yet imported and surfaces them as a dismissible/
  importable notification.
- Notification center: new data available, new PRs, new season bests,
  streaks (exact rules in section 5).

### Account data
- Export all of the current user's data as a downloadable JSON backup.
- Import/restore from a previously exported JSON backup — including a
  backup taken from the **old** app (schema-compatible, see section 9).

### Cross-cutting UI
- Theme: dark / light / system, plus reduced-motion; persisted per account.
- Responsive nav (desktop + mobile), floating action button for quick add.
- `/api/health` endpoint for the Docker health check (see section 8 — this
  is the one canonical path; the old app's bare `/health` is not carried
  over as a second alias).

---

## 4. Portable logic from the old app

Nothing here is copy-pasteable as Python into Nuxt — everything is
**translated to TypeScript**. What *does* carry over exactly is the
non-language-specific part: base URLs, query params, CSS selectors, and
regex patterns.

### OSTA (`https://www.osta.nl/`)
- **Fetch** — `osta_fetch_soup` — path `index.php`, query params `ZoekStr`
  (search), `pid` + `Seizoen` + `perAfstand=0` (season results). Port to
  `fetch()` + `cheerio.load()`.
- **Profile search** — `osta_lookup_candidates` — selectors
  `table.naam tr`, `form#tijden input[name='pid']`, `div#main h1`; PID is
  parsed from the profile link's `href` query string. Same selectors work
  unchanged in cheerio.
- **Season results scrape** — `extract_osta_results_for_pid` — selector
  `table.datum tr` for the per-race list, one detail-page fetch per race.
- **Detail page parsing** — `osta_build_laps_csv` (selector `table.rit tr`),
  `osta_extract_competition_name` (selector `p.wedinfo`, regex
  `^\d{4}-\d{2}-\d{2}\s+\d+\s+(.+)$` to strip the leading date/wid).
- **Multi-profile merge** — `merge_osta_results` — dedup/group key is
  `(date, normalized competition name, source pid)`; port the algorithm
  directly.
- See `reference/fixtures/osta/*.html` for exact response shapes to test
  the cheerio port against.

### SpeedSkatingResults (`speedskatingresults.com`)
- **Bases** — JSON API `.../api/json`, XML API `.../api/xml`.
- **Skater lookup (XML)** — `ssr_lookup_skater_id` — endpoint
  `skater_lookup.php?givenname=&familyname=`; response nodes
  `<skater><id>/<givenname>/<familyname>/<country>/<gender>/<category>`.
  Port with `fast-xml-parser`.
- **Results (JSON)** — `ssr_api_get` / `extract_ssr_results_for_skater` —
  endpoint `skater_results.php?skater=&season=&distance=`, called once per
  distance in `SSR_DISTANCES = (100,300,500,1000,1500,3000,5000,10000)`;
  competition grouping key from `ssr_competition_key` (event id parsed out
  of the result's `link` query string, else `name|location`). **SSR results
  never include lap times** — `laps_csv` is always `null` — carry that
  constraint into the new schema/UI (a race imported from SSR has no split
  table, only a total).
- **Time/status parsing** — `parse_ssr_time_value` — status tokens
  `DNF/DNS/DSQ/DQ/WDR/NC` map to "no time", decimal-comma normalization
  before falling into the generic time parser.
- See `reference/fixtures/ssr/*` for exact response shapes.

### PDF (KNSB paired-lane result sheets)
- **Skater line** — `parse_pdf_skater_line` — regex:
  ```
  ^(gl|bl|wt|rd)\s+\d+\s+(.+?)\s+([A-Z][A-Z0-9]{1,5})\s+([0-9:.]+)\s+([0-9:.]+|DNF|DNS|DSQ|DQ|WDR|NC)\b
  ```
- **Timing line (dual-lane)** — `parse_pdf_timing_line` — regex:
  ```
  ^(\d+)m\s+([0-9:.]+)\s+\(([0-9:.]+)\)\s+(\d+)m\s+([0-9:.]+)\s+\(([0-9:.]+)\)$
  ```
- **Timing line (single-lane)** — same function — regex:
  ```
  ^(\d+)m\s+([0-9:.]+)\s+\(([0-9:.]+)\)$
  ```
- **Block pairing** — `extract_pdf_pair_blocks` — looks for a literal header
  line `"Naam Cat PR Tijd Info"`, then reads skater lines at fixed offsets
  (`idx+1`, `idx+3`) and a numeric pair-number line at `idx+2`.
  **Known quirk, verified against the fixture**: the line immediately after
  the second skater line (`idx+4`) is *always* skipped — timing rows start
  at `idx+5` — so if a real sheet ever puts a legitimate split there, it is
  silently dropped. Decide whether to reproduce this exactly or fix it
  (recommendation: fix it — detect a timing line at `idx+4` instead of
  blindly skipping — but call the change out explicitly, since it changes
  which splits get imported from real PDFs).
- **Page date** — `extract_pdf_page_date` — regex `\bVan\s+(\d{1,2}-\d{1,2}-\d{4})\b`
  first, else the first date-shaped substring on the page.
- Use `pdf-parse` (or `pdfjs-dist`) for text extraction, then these same
  regexes/algorithm in TS. **Risk, not yet retired**: a different PDF
  library can emit the same visual content with different line breaks or
  ordering than `pdfplumber` did — see section 8's binding requirement to
  validate this early, against a *real* PDF, not just the synthetic
  `pdf/sample_sheet.txt` fixture (which is hand-built to match the regexes
  and therefore cannot catch a line-ordering mismatch).

### Split/pace math (pure functions — the ones with golden fixtures)
`opening_split_m`, `segment_distances`, `per400_times`, `build_split_rows`,
`compute_race_metrics` — direct port to TS; see section 5, every one of
these has fixed inputs/outputs in
`reference/fixtures/calculations/golden_calculations.json`, including a
documented normalization quirk on odd lap counts.

### Chart math (SVG coordinate builders)
`build_sparkline`, `build_split_chart`, `build_split_delta_series`,
`build_cumulative_delta_series`, `build_lap_overlay_series` — port the
coordinate/scale math into composables that return point/path data; render
with plain SVG in Vue components. No charting library needed.

### Target generation
`build_target_generator_profiles`, `generate_split_targets`,
`build_target_forecast` — direct port; add golden fixtures for these in
Phase 3 the same way section 5 does for split math (fix a distance +
history + target time, assert the generated per-split targets and
forecast).

### Import plumbing
`import_competition_signature`, `race_is_duplicate`,
`fetch_existing_competition_dates`, blacklist helpers — **superseded, not
just ported** — see section 6, which defines a stricter replacement.

### Backup export/import
`export_user_data` / `import_user_data` — port the JSON shape 1:1 (field
names included) so an export taken from the **old** app can be restored
into the new one; see `reference/fixtures/backup/export_sample.json` and
section 9.

Everything else (routing, templating, session handling, DB access) is
FastAPI/Jinja-specific and is rebuilt idiomatically in Nuxt.

---

## 5. Data contracts and acceptance tests (binding)

This section makes precise, testable statements about behavior that must
hold in the new app, backed by `reference/fixtures/calculations/golden_calculations.json`
(real outputs from the old app). **"Visually matches" and "spot-check" are
not acceptable substitutes for these tests** — Phase 2/3 must ship Vitest
tests asserting the exact numbers below before any comparable UI is
considered done.

### 5.1 Split/pace math
For each fixture case in `golden_calculations.json` → `split_math`, the
ported functions must produce byte-identical `total_time_ms`,
`segment_distances`, `per400_times`, and `metrics` values (floats compared
with a tight epsilon, e.g. `1e-9`). This includes the **3000m/1000m "odd
lap count" cases**, which reproduce a real normalization artifact in the
old app (a long final segment's raw lap time gets halved into an
implausibly fast 400m-equivalent). Phase 2 must explicitly decide — and
record in the PR description — whether the rebuild:
(a) reproduces this exactly (byte-parity with the old app), or
(b) fixes it (e.g. shows the raw segment time when it doesn't evenly
divide into 400m units, instead of a misleading normalized value).
Either is acceptable; silently doing one without saying so is not.

### 5.2 Lap-time input parsing
Per `golden_calculations.json` → `lap_input_parsing`: comma/space/tab/CR/LF
are all valid separators; **a single invalid split invalidates the whole
input** (no partial acceptance); error messages are user-facing strings (may
be translated, see section 11, but the *behavior* — all-or-nothing
validation — must be preserved).

### 5.3 Season boundaries
A season runs **September 1 → April 30** and is labeled `"{startYear}-{startYear+1}"`.
`season_label_for_date(d)`: if `month(d) >= 9`, season starts that
calendar year; otherwise (Jan–Aug) it starts the previous calendar year.
May–August dates (the off-season) are attributed to the season that just
ended, not the upcoming one. See `golden_calculations.json` →
`season_labeling` for the exact boundary-date test cases (Aug 31 vs. Sep 1,
Apr 30 vs. May 1).

### 5.4 PR (personal record) and SB (season best)
- **PR**: for a given distance, a race is a PR if its `total_time_ms` is
  **strictly less than** the best time seen so far for that distance, among
  races ordered by `(competition_date ASC, <ordering tiebreaker> ASC)`.
  A tie does **not** count as a new PR. Races with no time (see 5.6 status
  field) are excluded entirely from PR consideration.
- **SB**: same rule, scoped to races within one season label (5.3) instead
  of all-time.
- **Known bug, fixed in the rebuild**: the old app's ordering tiebreaker for
  same-day races is raw DB insertion order (`id ASC`), which does not
  necessarily match the real order the races happened in — see
  `golden_calculations.json` → `known_bug_same_day_ordering` for a
  worked example where insertion order flips which race "counts" as the
  PR-setter. **The new data model must carry an explicit ordering signal
  for same-day races** (section 7's `sequence_in_day` field, or a full
  timestamp) so this is no longer accidental. This is a deliberate,
  documented behavior change from the old app — call it out in the Phase 2
  PR description.
- **Streak**: walking races newest-first, count consecutive races that are
  each either a PR or an SB; stop at the first race that's neither.
- **"Recent"** (for the notification center's "new PRs"/"new SBs" lists):
  competition date within the last 30 days of "now".

### 5.5 Search / filter behavior (competitions & races lists)
- Free-text query matches **case-insensitive substring** on `name` OR
  `venue` (`LOWER(name) LIKE '%q%' OR LOWER(venue) LIKE '%q%'`).
- Venue filter is an **exact, case-insensitive** match (not substring).
- Date range filters are inclusive on both ends (`date >= from AND date <= to`).
- An invalid date filter value clears itself back to "no date filter" and
  surfaces an error message rather than 500ing or silently ignoring the
  other filters.

### 5.6 Result status (replacing the old boolean `dnf`)
Import sources use `DNF/DNS/DSQ/DQ/WDR/NC` as status tokens (5.4's SSR time
parser) but the old race table only stores a boolean `dnf`, discarding
which of the six it was. The new schema uses an explicit enum (section 7);
all six statuses behave like the old `dnf=1` for PR/SB/stats purposes (no
time, excluded from records) but the **specific status is preserved and
shown** on the race detail page instead of being collapsed to a generic
"DNF" label.

### 5.7 Race-level de-duplication (import safety)
See section 6 — this is expanded into its own section given how central it
is to import correctness.

---

## 6. Import de-duplication (binding, replaces the old ad-hoc logic)

The old app's de-dup was two disconnected checks: a per-user set of
*existing competition dates* (crude — any competition sharing a date with a
new import candidate is treated as "possibly the same") and an exact
field-match `race_is_duplicate` (total_time_ms + lane + opponent + laps_csv
+ dnf, all fields must match) scoped to races **already inside the matched
competition**. This is deduplication by accident, not by design. The
rebuild defines it explicitly:

**Competition identity** = `(competition_date, normalized name, source)`
where `source` disambiguates parallel imports of the same real-world event
from different providers (see below) rather than silently merging or
silently duplicating them.

**Race identity within a competition** = `(distance_m, lane, opponent,
total_time_ms, status, laps fingerprint)`. Two races with the same distance
but different lane/opponent (a real dead heat, or a different heat
entirely) are different races. Two races with identical distance/lane/
opponent/time/laps are the same race re-seen.

Required behaviors, explicitly:

1. **Same competition via OSTA AND SSR.** These are two different
   `source` values scraping the same real-world event. Do **not** silently
   merge them into one competition row (provenance would be lost) and do
   **not** silently create two duplicate competitions either. Match on
   `(competition_date, normalized name)` across sources; when a match is
   found, attach the new source's races to the *existing* competition
   record (regardless of which source created it) and run race-level
   identity matching per race. A race that exists from OSTA with full laps
   and is re-seen from SSR with only a total time and the same
   `total_time_ms` is the same race (don't duplicate); if SSR's total time
   for that distance/date doesn't match any existing race, add it as a
   genuinely new race (e.g. the OSTA scrape missed it).
2. **Two races, same distance, same day.** Distinguished by lane/opponent
   when present; when both are empty/unknown (common for manual entries or
   SSR imports with no lane data), treat them as distinct races **unless**
   every other field matches exactly (see race identity above) — i.e. don't
   collapse two genuinely different same-distance same-day results just
   because neither happened to record a lane.
3. **Corrected results / laps added later.** If a race with identical
   `(distance_m, lane, opponent)` already exists for that competition but
   `total_time_ms` or the laps differ from the new import, **do not**
   silently overwrite it and do not create a duplicate either — surface it
   in the import preview as an **update candidate** ("this looks like a
   correction to race #123 — replace / keep both / skip") and require an
   explicit choice. Never auto-merge a time change silently; a corrected
   result and a genuinely different second attempt look identical from the
   data alone.
4. **A race was deleted from a kept competition.** Deleting a single race
   (not the whole competition) must **not** blacklist the competition — the
   next import of that same competition must be able to re-add just that
   race without re-adding races the user deliberately removed. This means
   per-race deletions need their own "don't re-import this specific race"
   marker (a race-level blacklist entry keyed by the race identity above),
   separate from the competition-level blacklist used by "delete and
   blacklist [the whole competition]".
5. **Re-running the same import is always safe (idempotent).** Importing
   the same OSTA/SSR/PDF payload twice in a row must produce zero new rows
   the second time — this is the property all four rules above exist to
   guarantee, and it needs its own test: import fixture X, assert N rows
   created; import fixture X again, assert **zero** new rows created and no
   existing rows changed.
6. **Atomicity.** Committing an import preview batch (any source) is one
   database transaction: either every competition/race in the batch is
   written, or none are, on any failure mid-batch. No partial imports.

---

## 7. Data model (Drizzle schema, SQLite) — completed

Fixes applied vs. the previous draft: explicit status enum, structured lap
storage, multi-profile OSTA linking, and the ordering signal from section
5.4.

- **`users`**: id, username, password_hash, skater_name, is_admin,
  theme_pref, motion_pref, session_version (int, bumped on password
  change/reset and on account deletion — carries the old app's existing
  `session_version` mechanism forward, see section 8), created_at.
- **`osta_profile_links`** (NEW — replaces the old single `osta_pid`
  column): `(id, user_id, pid, search_name, is_primary, monitor_mode,
  season, last_checked_at, created_at)`. A user can have **multiple**
  linked OSTA profiles (e.g. results under two slightly different name
  spellings, or a club-transfer split); the monitor checks all of them.
- **`competitions`**: id, user_id, name, venue, date, source (`manual` |
  `osta` | `ssr` | `pdf`), source_meta (json — pid/skater-id/filename as
  applicable), created_at.
- **`races`**: id, competition_id, user_id, distance_m,
  **`status`** (enum: `finished` | `dnf` | `dns` | `dsq` | `dq` | `wdr` |
  `nc` — replaces the old boolean `dnf`, per 5.6), total_time_ms
  (nullable — null whenever status != finished), track_type (enum:
  `indoor` | `outdoor`), lane, opponent, category, class_name, tag
  (enum, the situational list in section 3 — `outdoor` removed, now
  `track_type`), notes, source, source_ref (link/id back to the source
  race), **`sequence_in_day`** (NEW — small int, default 0, explicit
  tiebreaker for same-day races per section 5.4; UI lets the user reorder
  same-day races instead of relying on insertion order), created_at,
  updated_at.
- **`race_laps`** (NEW — replaces `laps_csv` TEXT): `(id, race_id,
  lap_index, lap_ms)`, one row per lap, `lap_ms` an **integer**
  (milliseconds, no floats) with a unique `(race_id, lap_index)` constraint.
  Structured storage makes the split/pace math (section 5.1) operate on
  typed integers instead of parsing a CSV string on every read.
- **`targets`**: `(user_id, distance_m, target_time_ms, generator_profile_json)`,
  composite PK.
- **`blacklist`**: competition-level, `(id, user_id, signature, competition_name,
  competition_date, created_at)` — signature per section 6.
- **`race_blacklist`** (NEW, per section 6 rule 4): `(id, user_id,
  competition_signature, race_identity_signature, created_at)` — prevents
  re-importing one specific deleted race without blacklisting its whole
  competition.
- **`import_preview_batches`**: `(id, user_id, source, payload_json,
  created_at, expires_at)`.
- **`update_candidates`** (NEW, per section 6 rule 3): rows staged during
  an import preview that look like a correction to an existing race,
  resolved (replace / keep both / skip) as part of committing the batch —
  can live inside `payload_json` rather than its own table if simpler; the
  requirement is the explicit choice, not the storage shape.

Migrations via Drizzle Kit, applied automatically on container start.

---

## 8. Target architecture (binding versions & decisions)

- **Nuxt**: pin to the latest Nuxt 3 LTS-equivalent release available when
  Phase 0 starts — write the exact resolved version (from `package-lock.json`
  / `pnpm-lock.yaml`) into this repo's Phase 0 PR description, not just "3.x".
- **Node**: pin to the current Node.js **Active LTS** major at Phase 0 time,
  and pin that same major in the Dockerfile's base image tag (no floating
  `-alpine` without a major version). Record the exact version in the same
  Phase 0 PR.
- **Database**: SQLite file on a mounted volume, Drizzle ORM +
  `better-sqlite3`.
- **Auth**: `nuxt-auth-utils` (sealed session cookie + password hashing) —
  **this is the committed choice, not a suggestion with a fallback.** Do
  not hand-roll session/cookie handling as a "fallback" if integration
  friction shows up; solve the friction within `nuxt-auth-utils` (it's
  actively maintained and covers this exact use case) rather than
  forking the auth story mid-project.
- **Access control — binding for Phase 1, not deferred**:
  - Every `server/api/**` route that reads or writes a
    user-owned resource (competitions, races, targets, import batches,
    exports, comparisons, blacklist entries) must check `resource.user_id
    === session.user.id` (or admin) before acting — as a shared helper
    (`requireOwnedResource(event, table, id)`), not ad-hoc per route, so it
    can't be forgotten on a new route.
  - Password reset (self-service or admin-triggered) and account deletion
    **must** bump `session_version` (carrying forward the old app's
    existing mechanism, section 7) so every other active session for that
    account is invalidated immediately, not just the one making the
    change.
  - **The last remaining admin cannot be demoted or deleted** — by
    themselves or by another admin. The old app only blocked
    *self*-demote/delete for a solo admin (see the FastAPI reference at
    `admin_user_role_update`/`admin_user_delete`/`delete_user_account`,
    commit 4dc6959); it did **not** check "is this the only admin left"
    when a *different* admin acted, nor on self-delete. The new app checks
    `COUNT(*) FROM users WHERE is_admin = true` before any demote/delete
    and refuses the last one, regardless of who's performing the action.
- **PDF text extraction — validate early, don't assume**: pick the Node PDF
  library (`pdf-parse` or `pdfjs-dist`) in **Phase 0**, and before Phase 6
  starts, run it against one real KNSB result-sheet PDF (not the synthetic
  `pdf/sample_sheet.txt`) and diff the extracted text's line order against
  what `pdfplumber` would have produced. The block-pairing algorithm
  (section 4) depends on fixed line offsets (`idx+1`, `idx+2`, `idx+3`); a
  different extraction order breaks it silently, not with an error. This is
  a go/no-go check before Phase 6, not something to discover mid-phase.
- **Import architecture — shared from the start**: Phase 5 (OSTA) builds
  the import pipeline (fetch → parse-to-common-shape → dedup per section 6
  → preview → commit) as source-agnostic from day one, with OSTA as the
  first `ImportSource` implementation. Phase 6 (SSR, PDF) adds two more
  `ImportSource` implementations to the same pipeline. No "consolidate the
  three importers" task should exist in Phase 6 — if one turns up, Phase 5
  didn't build it generically enough.
- **API surface**: Nitro server routes under `server/api/**`, one per
  resource/action.
- **Charts**: no charting library — ported SVG composables (section 4).
- **Styling**: Tailwind CSS + a CSS-variable design-token layer (section
  10).
- **Validation**: `zod` schemas shared between server routes and forms.
- **Testing**: Vitest for pure functions (section 5's golden fixtures are
  the first tests written, before their UI exists — see the reordered
  phases in section 12), Playwright for e2e smoke.
- **Docker**: multi-stage Dockerfile, `node:<pinned-LTS>-alpine` build →
  same runtime stage running `node .output/server/index.mjs`. One health
  check path: **`/api/health`** (not `/health` — the old app's bare path is
  not carried over as a second alias, avoiding the confusion flagged in
  review).
- **CI**: GitHub Actions — install, typecheck, lint, unit tests (incl.
  golden fixtures), Docker build on every PR.

---

## 9. Migration from the old app (risk investigated in Phase 0, not deferred)

Re-importing from OSTA/SSR is **not** a migration strategy on its own — it
would silently drop: free-text notes, targets, theme/motion preferences,
the blacklist, tags, and any manually-entered race lacking an online
source. A real migration path is required, and its feasibility must be
checked in **Phase 0**, not discovered late:

- **Phase 0 spike (required deliverable, not optional)**: write a
  throwaway script that reads a real old-app SQLite file (`competition`,
  `race`, `user`, `goal_target`, `osta_monitor_config`,
  `osta_import_blacklist` tables — see the schema in this repo's
  `app/main.py::init_db`/`migrate_db`, commit 4dc6959) and reports, per
  table, **row counts** and any rows that don't cleanly map onto the new
  schema (e.g. `laps_csv` values that don't parse into clean integers,
  `dnf=1` rows where the real status is ambiguous). This spike's output
  (a short counts report) gates whether Phase 8's real migration script is
  straightforward or needs schema adjustments made now, while the schema
  is still easy to change.
- **Phase 8 deliverable**: the real migration script, run against a copy of
  actual production data, producing a **before/after row-count report**
  per table (competitions, races, targets, blacklist entries, users) that
  must match (accounting for the `dnf` boolean → status enum expansion,
  which is a 1-to-1 remap, not a count change).
- **Rollback procedure**: the migration script only ever *reads* the old
  SQLite file (never mutates it) and only ever writes into a **fresh** new
  database file — so rollback is "point the new app back at nothing / redo
  the migration", never "undo a write against production." Document this
  explicitly in the Phase 8 PR so it's not assumed to be riskier than it is.
- The JSON export/import feature (section 3) is a **separate, ongoing**
  backup mechanism for the *new* app, going forward — not the old→new
  migration path, though it shares a schema lineage with
  `reference/fixtures/backup/export_sample.json`.

---

## 10. Design system

Direction: clean, modern, minimal, inspired by `portfolio.remcoland.nl`,
with **red** as the primary accent instead of that site's palette.

**This environment cannot reach `portfolio.remcoland.nl`** — outbound
requests to it are blocked by the sandbox's egress proxy (confirmed, not a
transient DNS issue), so the exact colors/type/spacing below are *informed
defaults*, not an extraction from the live site. **Before Phase 1 UI work
starts, you need to supply one of:**
1. A screenshot (or a few, covering hero/section/nav) of
   `portfolio.remcoland.nl`, or
2. The site's exported design tokens (colors, font names, spacing scale) if
   you have them from whatever built the portfolio, or
3. Explicit confirmation to just use the defaults below as final.

Default direction (replace with real tokens once you provide 1 or 2 above):
- **Typography**: one confident sans-serif for UI (Inter or Geist),
  monospace for all numeric/time values (kept from the old app's `.mono`
  convention) — JetBrains Mono or Geist Mono.
- **Color**: near-black/near-white neutral base (true dark mode), single
  red accent (~`#E5312B`–`#E23D28`, exact hue to confirm) used sparingly
  for primary actions, PR badges, and active nav.
- **Surfaces**: soft-rounded cards (`rounded-xl`/`2xl`), thin 1px borders
  instead of heavy drop shadows, generous whitespace.
- **Motion**: minimal, purposeful, fully disabled under reduced-motion.
- **Data density**: dashboard/stats stay information-dense inside the same
  card system — density lives inside cards, not in page chrome.

Design tokens (colors, spacing scale, radii, font stacks) live in one
`app/assets/css/tokens.css` (CSS variables) consumed by Tailwind config.

---

## 11. Information architecture (deliberately restructured)

The old app's nav (Statistieken / Targets / Wedstrijden / Ritten as four
flat top-level items, plus a separate Admin/Account menu) is **not**
carried over as-is — two related pairs get merged into one mental model
each:

```
Dashboard        overview cards, best times, latest competition, home
                 trends, OSTA new-data banner, notification center
Results          Competitions list -> Competition detail -> Races within it
                 (kept hierarchical, not flattened: a real competition
                 genuinely contains multiple races, and de-dup logic in
                 section 6 operates at that same granularity)
  /results/competitions
  /results/competitions/new
  /results/competitions/[id]
  /results/competitions/[id]/edit
  /results/races/new                 (competition_id optional query param)
  /results/races/[id]                race detail (section 3's field table)
  /results/races/[id]/edit
  /results/races/[id]/compare
Progress         Stats and Targets merged into one section (sub-tabs) since
                 they answer the same underlying question ("how am I
                 doing") and target-forecast already depends on stats data
  /progress/stats
  /progress/targets
Import           unchanged as its own area — it's a distinct workflow, not
                 naturally part of Results or Progress
  /import
  /import/osta/select
  /import/preview
Account          profile, password, linked OSTA profiles + monitor,
                 export, import/restore, delete account
  /account
  /admin/users   (admin only, linked from Account, not a top-level nav item)
```

Server API surface (`server/api/**`) mirrors this: e.g.
`server/api/results/races/[id].patch.ts`,
`server/api/import/osta/search.post.ts`,
`server/api/import/preview/[batchId]/commit.post.ts`,
`server/api/dashboard/osta-detection.get.ts`, `server/api/health.get.ts`.

A persistent `AppShell` layout holds nav, search, mobile menu, FAB, and
theme toggling.

---

## 12. Phased delivery plan

Each phase is scoped to be handed to Claude as **"execute phase N"** and be
actionable on its own, assuming prior phases are merged. Reordered from the
previous draft so calculation correctness (section 5) is proven with tests
**before** the UI that displays those calculations is built, and so access
control (section 8) is explicit in Phase 1 rather than assumed later.

### Phase 0 — Bootstrap, version pinning, migration spike
- Create the new GitHub repository. Tag this repo's reference commit
  `v1-reference` (section 1).
- Pin exact Nuxt/Node versions (section 8); record them in the PR.
- Confirm design tokens (section 10) — blocked on you supplying a
  screenshot/tokens/confirmation.
- `nuxt init`, TypeScript strict mode, ESLint + Prettier, Tailwind, Drizzle
  + better-sqlite3, `nuxt-auth-utils`, Vitest, Playwright scaffolding.
- Drizzle schema per section 7 + initial migration.
- **Migration spike (required)**: the read-only old-DB inspection script
  from section 9, run against a real old-app database export if you can
  provide one; report row counts and mapping risks.
- Pick the PDF text-extraction library (section 8); defer the real-PDF
  validation to just before Phase 6, but the library choice is made now.
- Dockerfile (multi-stage, pinned Node major) + `docker-compose.yml` +
  `.env.example`.
- `/api/health` route + Docker healthcheck pointed at it.
- GitHub Actions CI: install, typecheck, lint, test, docker build.
- **Acceptance**: `docker compose up -d --build` serves an empty Nuxt app
  with a working `/api/health` and green CI; migration spike report exists.

### Phase 1 — Auth, access control, shell, admin
- Session auth (login/logout) via `nuxt-auth-utils`.
- `requireOwnedResource` helper (section 8) — written now even though most
  resources don't exist yet, so every subsequent phase's routes use it from
  their first commit instead of retrofitting it later.
- `session_version` bump on password change/reset and account deletion;
  last-admin protection on demote/delete (section 8) — with tests for both.
- `AppShell` layout: top nav (per section 11's IA), search box, mobile nav,
  profile menu, theme toggle + reduced-motion, footer.
- `/account`: profile edit, password change, delete account.
- `/admin/users`: list/create/reset-password/promote/delete, refusing the
  last-admin cases.
- **Acceptance**: can log in, navigate the empty shell, manage users as
  admin (including verifying the last-admin refusal), switch theme; a
  second session for a user whose password was just reset is confirmed
  logged out on its next request.

### Phase 2 — Calculation engine (tested before UI)
- Port section 4/5's pure functions to TypeScript:
  `openingSplitM`, `segmentDistances`, `per400Times`, `buildSplitRows`,
  `computeRaceMetrics`, lap-input parsing, `fmtMs`, `seasonLabelForDate`,
  PR/SB sequencing (with the fixed `sequence_in_day` tiebreaker, section
  5.4), search/filter query building.
- Vitest suite asserting every case in
  `reference/fixtures/calculations/golden_calculations.json`, including a
  written decision (in code comments + PR description) on the 3000m/1000m
  odd-lap-count quirk (5.1).
- **No race/competition UI yet** — this phase ships as a library + tests,
  reviewed and merged before Phase 3 touches a template.
- **Acceptance**: `npm run test` is green against every golden fixture
  case; the odd-lap-count decision is documented.

### Phase 3 — Core CRUD: competitions & races
- Drizzle queries/services for competitions, races, `race_laps`.
- `/results/competitions`, `.../new`, `.../[id]`, `.../[id]/edit`, delete +
  delete-and-blacklist.
- `/results/races/new`, `/results/races/[id]`, `.../edit`, delete +
  delete-and-blacklist.
- Race detail renders every field in section 3's table, using Phase 2's
  tested calculation engine — not new inline math.
- Search/filter (section 5.5's exact contract) shared between the two list
  pages.
- **Acceptance**: manual data entry works end-to-end, including status
  (5.6), track type, lane/opponent, tags, structured laps; every number
  shown on race detail matches Phase 2's tests for the same input.

### Phase 4 — Dashboard, stats, targets
- `/` dashboard: overview cards, best-times table, latest-competition card,
  home trends sparkline, season filter.
- `/progress/stats`: all sections, season/distance filters, using Phase 2's
  PR/SB engine directly.
- `/progress/targets`: CRUD + generated split targets + forecast (ported
  per section 4), with its own golden fixtures added to
  `golden_calculations.json` before the UI ships.
- **Acceptance**: dashboard/stats/targets numbers match Phase 2's tested
  engine for the same seeded data — not a visual spot-check.

### Phase 5 — Race comparison & analytics
- `/results/races/[id]/compare`: split-delta chart, cumulative-delta chart,
  lap overlay chart, strongest/weakest segment, pacing labels, narrative
  summary (ported per section 4).
- **Acceptance**: comparing two races against a fixed fixture pair produces
  the same delta numbers as the old app for those two races (add this pair
  to the golden fixtures).

### Phase 6 — Import: OSTA (generic pipeline)
- Build the source-agnostic import pipeline described in section 8
  (fetch → parse-to-common-shape → dedup per section 6 → preview → commit,
  one DB transaction per commit) with OSTA as the first `ImportSource`.
- OSTA server routes: search/candidates, results scrape, lap/detail scrape
  (cheerio, per section 4), tested against `reference/fixtures/osta/*.html`.
- `/import` OSTA form → `/import/osta/select` on multi-match →
  `/import/preview` (including update-candidate resolution, section 6 rule
  3) → commit/discard.
- Blacklist read/write (competition-level and race-level, section 7).
- **Acceptance**: importing the OSTA fixture produces the expected
  competitions/races; re-running the same import produces zero new rows
  (section 6 rule 5, tested).

### Phase 7 — Import: SSR & PDF (same pipeline, new sources)
- SSR and PDF as two more `ImportSource` implementations on Phase 6's
  pipeline — no separate preview UI, no consolidation work.
- **Go/no-go check before starting the PDF work**: run the chosen PDF
  library against a real result-sheet PDF and confirm line ordering matches
  what the ported regexes expect (section 8) — if it doesn't, fix the
  parser against real output before writing tests against the synthetic
  fixture.
- Cross-source dedup tested explicitly: import the same competition via
  OSTA then via SSR (section 6 rule 1) and assert one competition, correct
  race attachment, no duplicates.
- **Acceptance**: SSR and PDF imports both work against real sample data,
  land in the same preview/commit UX as OSTA, and the cross-source dedup
  test passes.

### Phase 8 — OSTA monitor, notifications, and v1→v2 migration
- OSTA monitor config (multiple linked profiles, section 7) in account
  settings; detection check on dashboard load.
- Dashboard banner (ignore/import) + notification center (new data, new
  PRs, new SBs, streaks — section 5.4's exact rules).
- **Real migration script** (section 9): run against actual old-app data,
  produce the before/after row-count report, verify the rollback story
  (read-only against the old file).
- **Acceptance**: linking an OSTA profile surfaces new competitions and can
  import/ignore them; the migration script's count report matches
  expectations on real data.

### Phase 9 — Account data export/import
- Export current user data as JSON (section 4/9, schema-compatible with
  `reference/fixtures/backup/export_sample.json`).
- Import/restore from that JSON, including a backup taken from the **old**
  app.
- **Acceptance**: `export_sample.json` (an old-app-shaped backup) restores
  successfully into the new app with matching competitions/races/targets.

### Phase 10 — Polish & production hardening
- Full responsive pass, accessibility pass (focus states, aria labels,
  contrast against the final red palette from section 10).
- Error/empty states across all pages.
- Playwright e2e smoke suite (login, manual add, one import path, compare,
  export/import, admin last-admin-protection).
- Final Docker image size/startup check, backup/restore doc, deployment
  doc.
- **Acceptance**: production-ready — tag `v1.0.0` of the new repo.

---

## 13. Open questions

1. Design tokens (section 10) — need your input before Phase 1 UI work.
2. New repo name, and whether the old repo gets archived/renamed/kept as
   reference (recommend: keep as-is, read-only reference, per this plan).
3. Whether admin bootstrap stays CLI-driven or moves to a first-run web
   setup screen.
4. Whether the OSTA monitor check should stay dashboard-load-triggered (as
   today) or become a real scheduled background task — low priority, can
   default to "dashboard-load" unless you want it otherwise.
5. UI language — keep Dutch copy (as today) or translate to English.
6. Section 5.1's odd-lap-count quirk: reproduce or fix? (Recommendation:
   fix, since it's a correctness bug, not a feature — but it's your call
   since it changes historical numbers users may have screenshotted.)
7. Can you provide a real old-app SQLite export (or at least representative
   row counts) for the Phase 0 migration spike, and a real OSTA/SSR
   response + PDF sheet before Phases 6/7, given this environment can't
   reach those services itself?
