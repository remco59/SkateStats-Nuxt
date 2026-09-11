import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
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

describe('OSTA scraper (against reference fixtures)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url)
        if (parsed.searchParams.has('ZoekStr')) {
          return new Response(fixture('search_results.html'))
        }
        if (parsed.searchParams.get('pid') === 'NL12345' && parsed.searchParams.has('Seizoen')) {
          return new Response(fixture('results_list.html'))
        }
        if (parsed.searchParams.get('ritid') === '9002') {
          return new Response(fixture('race_detail.html'))
        }
        // Other detail-page fetches (ritid 9001, 9003) in results_list.html
        // aren't fixture-covered individually -- return an empty detail page.
        return new Response('<html><body><div id="main"></div></body></html>')
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('finds multiple candidates and throws OstaMultipleMatchesError from ostaLookupPid', async () => {
    const candidates = await ostaLookupCandidates('Jansen, Remco')
    expect(candidates).toHaveLength(2)
    expect(candidates[0]).toMatchObject({ pid: 'NL12345', name: 'Jansen, Remco' })
    expect(candidates[1]).toMatchObject({ pid: 'NL67890', name: 'Jansen, R.' })

    await expect(ostaLookupPid('Jansen, Remco')).rejects.toBeInstanceOf(OstaMultipleMatchesError)
  })

  it('extracts season results grouped by competition, with laps from the detail page', async () => {
    const parsed = await extractOstaResultsForPid('Jansen, Remco', '2024', 'NL12345')
    expect(parsed.pid).toBe('NL12345')
    expect(parsed.competitions).toHaveLength(2)

    const heerenveenComp = parsed.competitions.find((c) => c.date === '2024-11-16')!
    expect(heerenveenComp.name).toBe('KNSB Bekerwedstrijd Heerenveen')
    expect(heerenveenComp.venue).toBe('Heerenveen (NED)')
    expect(heerenveenComp.results).toHaveLength(2)

    const race1500 = heerenveenComp.results.find((r) => r.distanceM === 1500)!
    expect(race1500.totalTimeMs).toBe(133900)
    // Laps come from race_detail.html (ritid=9002), the only detail page this
    // test fixture-serves real content for.
    expect(race1500.lapsCsv).toBe('41.50,30.20,30.80,31.40')

    const race500 = heerenveenComp.results.find((r) => r.distanceM === 500)!
    expect(race500.totalTimeMs).toBe(40550)

    const alkmaarComp = parsed.competitions.find((c) => c.date === '2025-01-11')!
    expect(alkmaarComp.venue).toBe('Alkmaar (NED)')
    expect(alkmaarComp.results).toHaveLength(1)
    expect(alkmaarComp.results[0]!.distanceM).toBe(1000)
    expect(alkmaarComp.results[0]!.totalTimeMs).toBe(72000)
  })

  it('mergeOstaResults dedupes races seen from multiple profile pids', async () => {
    const parsedA = await extractOstaResultsForPid('Jansen, Remco', '2024', 'NL12345')
    const merged = mergeOstaResults('Jansen, Remco', [parsedA, parsedA])
    // Merging the same parsed payload with itself must not duplicate races.
    const heerenveenComp = merged.competitions.find((c) => c.date === '2024-11-16')!
    expect(heerenveenComp.results).toHaveLength(2)
  })
})
