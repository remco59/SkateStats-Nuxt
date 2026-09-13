# Reference fixtures

These fixtures are the shared reference data for the rebuild. They pin down
exactly what the old app's importers and calculators accept, so a future
Claude session can write a parser/port and check it against a fixed input
instead of guessing at "real" OSTA/SSR/PDF shapes.

**Provenance**: `osta/*` and `ssr/*` were originally hand-built synthetic
fixtures (no network access at rebuild time) and, as flagged as a risk to
close out in `REBUILD_PLAN.md` section 4/8, that risk materialized: real
osta.nl/speedskatingresults.com traffic didn't match several of the
synthetic fixtures' assumptions (see issue #7). They've since been replaced
with real responses captured 2026-09-13 from live OSTA/SSR requests for two
real, public skaters. Concretely, the synthetic fixtures got wrong:
- OSTA `ZoekStr` search only matches names in "Voornaam Achternaam" order
  and breaks entirely (falls back to a WedNr/relation-number lookup that
  always misses) if the query contains a comma — this app's UI asks for
  "Achternaam, Voornaam", so `defaultOstaSearchName` now reorders it.
- OSTA season-results dates (`table.datum`) render as `D-M-YYYY`, not
  zero-padded (e.g. `2-11-2025`, `15-03-2026`) — not `YYYY-MM-DD` as
  assumed, which silently dropped every real row via the old
  all-or-nothing `parseOstaDate`.
- SSR's `skater_lookup.php` response includes a `<suffix>` (birth year)
  element for disambiguating same-name skaters, which wasn't parsed.

Areas that turned out to already be correct against live data: SSR's
`m.ss,hh` time format (`parseSsrTimeValue`), SSR/OSTA's `season`/`Seizoen`
param as a literal season-start year (confirmed against real season
boundaries — a race in March 2026 is `season=2025`, i.e. the 2025/2026
season), OSTA's `table.rit` lap-detail shape, and `p.wedinfo` competition-name
extraction.

`calculations/*` are derived by literally calling the old app's Python
functions (`main.py` at commit `4dc69595620a268137be4c19f554301e14b8e6da`)
with the given inputs — see `golden_calculations.json`'s `"generated_by"`
field. Those outputs are real old-app behavior, not guesses, including the
quirks called out in REBUILD_PLAN.md section 4.

- `osta/search_results.html` — real `index.php?ZoekStr=Kjeld Nuis` response:
  one real skater with four separate OSTA profile records under the same
  name (exercises the multi-candidate/`OstaMultipleMatchesError` path).
- `osta/search_results_single.html` — real `index.php?ZoekStr=Remco Land`
  response: a single-candidate match, which OSTA redirects straight to the
  profile/season page instead of a `table.naam` list (exercises
  `ostaLookupCandidates`'s `form#tijden`/`h1` fallback path).
- `osta/results_list.html` — real
  `index.php?pid=...&Seizoen=2025&perAfstand=0` response (the `table.datum`
  rows), including real same-day multi-distance and same-day/same-distance
  re-skate grouping.
- `osta/race_detail.html` — real single race detail page (the `table.rit`
  lap rows + `p.wedinfo` competition line) for one of `results_list.html`'s
  races.
- `ssr/skater_lookup.xml` — real `skater_lookup.php` response, one match.
- `ssr/skater_lookup_multiple.xml` — real `skater_lookup.php` response for
  a name shared by three real skaters (exercises the multi-match error
  path and the real `<suffix>` disambiguation field).
- `ssr/results_500.json`, `ssr/results_1000.json`, `ssr/results_1500.json`
  — real `skater_results.php` responses for the same skater/season across
  distances (the other `SSR_DISTANCES` entries returned real, empty
  responses for this skater/season and aren't separately fixture-backed).
- `pdf/sample_sheet.txt` — plain-text lines matching the KNSB paired-lane
  sheet format the PDF regexes expect (see section 4). This is text, not a
  real PDF, because the parser in the old app operates on
  `page.extract_text()` output — capture a real PDF's extracted text the
  same way once Phase 6 starts, to catch cases where a different PDF
  library orders lines differently (this is explicitly called out as a risk
  in REBUILD_PLAN.md section 5).
- `backup/export_sample.json` — shape of an account export
  (`export_user_data` in the old app), for testing the restore path.
- `calculations/golden_calculations.json` — fixed lap-time inputs with the
  exact outputs the old app produces today, plus the dedicated PR/SB/dedup
  scenarios from REBUILD_PLAN.md section 4.
