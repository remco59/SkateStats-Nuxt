import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultOstaSearchName,
  extractOstaResultsForPid,
  mergeOstaResults,
  ostaLookupCandidates,
  ostaLookupPid,
  OstaMultipleMatchesError,
} from '../../server/utils/import/osta'

const FIXTURES = join(__dirname, '../../reference/fixtures/osta')

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8')
}

const LAND_PID = '86651033-b5c2-4819-2162-08ddeb0685e4'
const SOFTELS_500_ID = 'e8db8523-9ac1-4287-b8c7-a24859a259e0'

describe('defaultOstaSearchName', () => {
  // Regression coverage for issue #7: this app's UI asks for names in
  // "Achternaam, Voornaam" order (matching the PDF importer's convention),
  // but OSTA's ZoekStr search matches substrings in "Voornaam Achternaam"
  // order and breaks entirely (falls back to a WedNr lookup that always
  // misses) if the query contains a comma at all -- confirmed against
  // live osta.nl.
  it('reorders "Achternaam, Voornaam" into "Voornaam Achternaam"', () => {
    expect(defaultOstaSearchName('Land, Remco')).toBe('Remco Land')
  })

  it('leaves names without a comma unchanged', () => {
    expect(defaultOstaSearchName('Remco Land')).toBe('Remco Land')
  })

  it('handles multi-word family names', () => {
    expect(defaultOstaSearchName('Knuistingh Neven, Lisanne')).toBe('Lisanne Knuistingh Neven')
  })

  it('falls back to comma-stripped input if either side is empty', () => {
    expect(defaultOstaSearchName('Land,')).toBe('Land')
  })
})

describe('OSTA scraper (against real captured fixtures, issue #7)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url)
        if (parsed.searchParams.get('ZoekStr') === 'Kjeld Nuis') {
          return new Response(fixture('search_results.html'))
        }
        if (parsed.searchParams.get('ZoekStr') === 'Remco Land') {
          return new Response(fixture('search_results_single.html'))
        }
        if (parsed.searchParams.get('pid') === LAND_PID && parsed.searchParams.has('Seizoen')) {
          return new Response(fixture('results_list.html'))
        }
        if (parsed.pathname.endsWith('/rit.php') && parsed.searchParams.get('ID') === SOFTELS_500_ID) {
          return new Response(fixture('race_detail.html'))
        }
        // Other rit.php detail fetches referenced by results_list.html aren't
        // individually fixture-covered -- return an empty detail page.
        return new Response('<html><body><div id="main"></div></body></html>')
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('finds multiple candidates (one real skater, four OSTA profile records) and throws OstaMultipleMatchesError', async () => {
    // "Nuis, Kjeld" is the UI's documented input convention; ostaLookupCandidates
    // must reorder it to "Kjeld Nuis" itself before it ever reaches OSTA.
    const candidates = await ostaLookupCandidates('Nuis, Kjeld')
    expect(candidates).toHaveLength(4)
    expect(candidates.map((c) => c.pid)).toEqual([
      '6726',
      '63050472092709388',
      '63050472092709245',
      '822026c3-a2e6-4a2b-a2e8-6c5e2d7fbf7b',
    ])
    expect(candidates[0]).toMatchObject({ name: 'Kjeld Nuis', category: 'HC1-HSA', club: 'IJsvereniging Leiden' })

    await expect(ostaLookupPid('Nuis, Kjeld')).rejects.toBeInstanceOf(OstaMultipleMatchesError)
  })

  it('resolves a single-candidate search via the profile-redirect fallback (form#tijden pid + h1)', async () => {
    const found = await ostaLookupPid('Land, Remco')
    expect(found).toEqual({ pid: LAND_PID, name: 'Remco Land' })
  })

  it('extracts season results grouped by competition, with real D-M-YYYY dates parsed correctly', async () => {
    const parsed = await extractOstaResultsForPid('Remco Land', '2025', LAND_PID)
    expect(parsed.pid).toBe(LAND_PID)
    expect(parsed.competitions).toHaveLength(4)

    const softels = parsed.competitions.find((c) => c.date === '2026-03-15')!
    expect(softels.name).toBe('SoftELS IUT 2026')
    expect(softels.venue).toBe('Heerenveen (NED)')
    expect(softels.results).toHaveLength(2)

    const race500 = softels.results.find((r) => r.distanceM === 500)!
    expect(race500.totalTimeMs).toBe(55400)
    // Laps come from race_detail.html (the only detail page this test
    // fixture-serves real content for).
    expect(race500.lapsCsv).toBe('13.71,41.69')

    const race1000 = softels.results.find((r) => r.distanceM === 1000)!
    expect(race1000.totalTimeMs).toBe(112970)
    expect(race1000.lapsCsv).toBeNull()

    const gssk = parsed.competitions.find((c) => c.date === '2026-03-08')!
    expect(gssk.venue).toBe('Groningen (NED)')
    expect(gssk.results).toHaveLength(2)
    expect(gssk.results.map((r) => r.totalTimeMs).sort()).toEqual([56870, 58170])

    const daikin = parsed.competitions.find((c) => c.date === '2025-11-02')!
    expect(daikin.results).toHaveLength(1)
    expect(daikin.results[0]!.distanceM).toBe(1000)
    expect(daikin.results[0]!.totalTimeMs).toBe(68440)
  })

  it('mergeOstaResults dedupes races seen from multiple profile pids', async () => {
    const parsedA = await extractOstaResultsForPid('Remco Land', '2025', LAND_PID)
    const merged = mergeOstaResults('Remco Land', [parsedA, parsedA])
    const softels = merged.competitions.find((c) => c.date === '2026-03-15')!
    expect(softels.results).toHaveLength(2)
  })
})
