import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, seedUser } from './helpers/test-db'
import { extractOstaResultsForPid } from '../../server/utils/import/osta'
import { ostaResultsToImportPayload } from '../../server/utils/import/osta-source'
import { extractSsrResultsForSkater } from '../../server/utils/import/ssr'
import { ssrResultsToImportPayload } from '../../server/utils/import/ssr-source'
import { classifyImportPayload, commitPreviewBatch } from '../../server/utils/import/pipeline'
import { competitions } from '../../server/db/schema'

const OSTA_FIXTURES = join(__dirname, '../../reference/fixtures/osta')
const SSR_FIXTURES = join(__dirname, '../../reference/fixtures/ssr')

function readFixture(dir: string, name: string): string {
  return readFileSync(join(dir, name), 'utf-8')
}

const LAND_PID = '86651033-b5c2-4819-2162-08ddeb0685e4'
const SOFTELS_500_ID = 'e8db8523-9ac1-4287-b8c7-a24859a259e0'

/**
 * results_500.json/results_1000.json are full real season captures (used
 * as-is by ssr.test.ts) that include several other real competitions
 * besides "SoftELS IUT 2026" -- some of which OSTA and SSR name
 * differently for the same real event (e.g. OSTA's
 * "Tjas clubwedstrijd/GSSK 8 maart 2026" vs SSR's "Tjas Clubwedstrijd/GSSK"),
 * so they wouldn't dedupe by competitionSignature even though results_list.html
 * also includes them. That's real-world data untidiness, not something this
 * importer bug fix is meant to solve -- filter the real fixture down to just
 * the SoftELS entries here so this test stays focused on the one dedup
 * mechanic it's asserting on.
 */
function ssrFixtureFilteredToSoftels(dir: string, name: string): string {
  const payload = JSON.parse(readFixture(dir, name)) as { results: { name: string }[] }
  return JSON.stringify({ ...payload, results: payload.results.filter((r) => r.name === 'SoftELS IUT 2026') })
}

/**
 * REBUILD_PLAN.md section 6 rule 1 / Phase 7 acceptance: importing the
 * same real-world competition via OSTA and then via SSR must attach to
 * ONE competition record, not create a duplicate -- using the actual
 * scraper + converter modules for both sources (not hand-built payloads),
 * against real captured fixtures (issue #7) that both describe the same
 * real "SoftELS IUT 2026" 2026-03-15 event for the same real skater.
 */
describe('cross-source de-duplication: OSTA then SSR', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('osta.nl')) {
          const parsed = new URL(url)
          if (parsed.searchParams.has('ZoekStr')) return new Response(readFixture(OSTA_FIXTURES, 'search_results_single.html'))
          if (parsed.searchParams.get('pid') === LAND_PID && parsed.searchParams.has('Seizoen')) {
            return new Response(readFixture(OSTA_FIXTURES, 'results_list.html'))
          }
          if (parsed.pathname.endsWith('/rit.php') && parsed.searchParams.get('ID') === SOFTELS_500_ID) {
            return new Response(readFixture(OSTA_FIXTURES, 'race_detail.html'))
          }
          return new Response('<html><body><div id="main"></div></body></html>')
        }
        if (url.includes('speedskatingresults.com')) {
          if (url.includes('skater_lookup.php')) return new Response(readFixture(SSR_FIXTURES, 'skater_lookup.xml'))
          if (url.includes('skater_results.php')) {
            const parsed = new URL(url)
            const distance = parsed.searchParams.get('distance')
            if (distance === '500') return new Response(ssrFixtureFilteredToSoftels(SSR_FIXTURES, 'results_500.json'))
            if (distance === '1000') return new Response(ssrFixtureFilteredToSoftels(SSR_FIXTURES, 'results_1000.json'))
            return new Response(JSON.stringify({ results: [] }))
          }
        }
        throw new Error(`unexpected fetch: ${url}`)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('attaches the SSR-seen race to the OSTA-created competition instead of duplicating it', async () => {
    const db = createTestDb()
    const user = seedUser(db)

    const ostaParsed = await extractOstaResultsForPid('Remco Land', '2025', LAND_PID)
    const ostaPreview = classifyImportPayload(db, user.id, ostaResultsToImportPayload(ostaParsed))
    expect(ostaPreview.items.find((i) => i.competition.date === '2026-03-15')!.action).toBe('new_competition')
    commitPreviewBatch(db, user.id, ostaPreview)

    const ssrParsed = await extractSsrResultsForSkater('121536', '2025')
    const ssrPreview = classifyImportPayload(db, user.id, ssrResultsToImportPayload(ssrParsed))

    const softelsItem = ssrPreview.items.find((i) => i.competition.date === '2026-03-15')!
    expect(softelsItem.action).toBe('attach_to_existing')

    const race500 = softelsItem.races.find((r) => r.race.distanceM === 500)!
    // Same time (55400ms), same status, but OSTA's race has laps (from
    // race_detail.html) and SSR's has none -- different laps fingerprint
    // -> update_candidate (a correction/enrichment candidate), not
    // silently merged, per rule 3.
    expect(race500.action).toBe('update_candidate')

    // OSTA's 1000m race at this same event has no real detail fixture
    // (generic empty detail page -> no laps), so it matches SSR's
    // lapless 1000m race exactly -> identical, no action needed.
    const race1000 = softelsItem.races.find((r) => r.race.distanceM === 1000)!
    expect(race1000.action).toBe('identical')

    const result = commitPreviewBatch(db, user.id, ssrPreview)
    expect(result.importedCompetitions).toBe(0)

    const competitionsCount = db.select().from(competitions).all().length
    // SoftELS (shared) + GSSK + Daikin + Tjas (OSTA-only) from results_list.html.
    expect(competitionsCount).toBe(4)
  })
})
