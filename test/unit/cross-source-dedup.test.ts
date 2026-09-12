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

/**
 * REBUILD_PLAN.md section 6 rule 1 / Phase 7 acceptance: importing the
 * same real-world competition via OSTA and then via SSR must attach to
 * ONE competition record, not create a duplicate -- using the actual
 * scraper + converter modules for both sources (not hand-built payloads),
 * against the real reference fixtures, both of which describe the same
 * "KNSB Bekerwedstrijd Heerenveen" 2024-11-16 event.
 */
describe('cross-source de-duplication: OSTA then SSR', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('osta.nl')) {
          const parsed = new URL(url)
          if (parsed.searchParams.has('ZoekStr')) return new Response(readFixture(OSTA_FIXTURES, 'search_results.html'))
          if (parsed.searchParams.get('pid') === 'NL12345' && parsed.searchParams.has('Seizoen')) {
            return new Response(readFixture(OSTA_FIXTURES, 'results_list.html'))
          }
          if (parsed.searchParams.get('ritid') === '9002') return new Response(readFixture(OSTA_FIXTURES, 'race_detail.html'))
          return new Response('<html><body><div id="main"></div></body></html>')
        }
        if (url.includes('speedskatingresults.com')) {
          if (url.includes('skater_lookup.php')) return new Response(readFixture(SSR_FIXTURES, 'skater_lookup.xml'))
          if (url.includes('skater_results.php')) {
            const parsed = new URL(url)
            if (parsed.searchParams.get('distance') === '1500') return new Response(readFixture(SSR_FIXTURES, 'results.json'))
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

    const ostaParsed = await extractOstaResultsForPid('Jansen, Remco', '2024', 'NL12345')
    const ostaPreview = classifyImportPayload(db, user.id, ostaResultsToImportPayload(ostaParsed))
    expect(ostaPreview.items.find((i) => i.competition.date === '2024-11-16')!.action).toBe('new_competition')
    commitPreviewBatch(db, user.id, ostaPreview)

    const ssrParsed = await extractSsrResultsForSkater('123456', '2024')
    const ssrPreview = classifyImportPayload(db, user.id, ssrResultsToImportPayload(ssrParsed))

    const heerenveenItem = ssrPreview.items.find((i) => i.competition.date === '2024-11-16')!
    expect(heerenveenItem.action).toBe('attach_to_existing')

    const race1500 = heerenveenItem.races.find((r) => r.race.distanceM === 1500)!
    // Same time (133900ms), same status, but OSTA's race has laps and SSR's
    // has none -- different laps fingerprint -> update_candidate (a
    // correction/enrichment candidate), not silently merged, per rule 3.
    expect(race1500.action).toBe('update_candidate')

    const result = commitPreviewBatch(db, user.id, ssrPreview)
    expect(result.importedCompetitions).toBe(0)

    const competitionsCount = db.select().from(competitions).all().length
    expect(competitionsCount).toBe(2) // Heerenveen (shared) + Alkmaar (OSTA-only)
  })
})
