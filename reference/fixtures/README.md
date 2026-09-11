# Reference fixtures

These fixtures are the shared reference data for the rebuild. They pin down
exactly what the old app's importers and calculators accept, so a future
Claude session can write a parser/port and check it against a fixed input
instead of guessing at "real" OSTA/SSR/PDF shapes.

**Provenance**: `osta/*` and `ssr/*` are hand-built synthetic fixtures that
match the exact HTML/XML/JSON shapes the old app's scrapers expect (see
`REBUILD_PLAN.md` section 4 for the exact selectors/endpoints they encode) —
they are not captured from live OSTA/SSR responses, since this environment
has no network access to those sites. **Before Phase 5/6 start**, replace
these with (or add alongside them) real captured responses for the
skater(s) you'll actually use, and a real PDF result sheet — network access
and the real PDF are things only you can provide. Until then, treat these
synthetic fixtures as "shape-correct, content-fictional".

`calculations/*` are derived by literally calling the old app's Python
functions (`main.py` at commit `4dc69595620a268137be4c19f554301e14b8e6da`)
with the given inputs — see `golden_calculations.json`'s `"generated_by"`
field. Those outputs are real old-app behavior, not guesses, including the
quirks called out in REBUILD_PLAN.md section 4.

- `osta/search_results.html` — response shape for `index.php?ZoekStr=...`
  with two matching profiles (exercises the multi-candidate path).
- `osta/results_list.html` — response shape for
  `index.php?pid=...&Seizoen=...&perAfstand=0` (the `table.datum` rows).
- `osta/race_detail.html` — response shape for a single race detail page
  (the `table.rit` lap rows + `p.wedinfo` competition line).
- `ssr/skater_lookup.xml` — response shape for `skater_lookup.php`.
- `ssr/results.json` — response shape for the JSON results endpoint.
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
