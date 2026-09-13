import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractSsrResultsForSkater, parseSsrTimeValue, ssrLookupSkaterId } from '../../server/utils/import/ssr'

const FIXTURES = join(__dirname, '../../reference/fixtures/ssr')

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8')
}

describe('parseSsrTimeValue (ported from parse_ssr_time_value)', () => {
  it.each([
    ['DNF', [null, 'dnf']],
    ['dns', [null, 'dns']],
    ['DSQ', [null, 'dsq']],
    ['1:12.00', [72000, 'finished']],
    ['1.12.00', [72000, 'finished']], // two dots, no colon -> first dot becomes a colon
    ['40,55', [40550, 'finished']], // comma decimal separator, no minutes
    // Real SSR API time format (captured 2026-09-13, issue #7): dot as the
    // minutes separator, comma as the decimal separator.
    ['1.00,28', [60280, 'finished']],
    ['55,40', [55400, 'finished']],
    ['', [null, 'finished']],
  ] as const)('parses %s', (input, expected) => {
    expect(parseSsrTimeValue(input)).toEqual(expected)
  })
})

describe('ssrLookupSkaterId (against real captured fixtures, issue #7)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url)
        if (url.includes('skater_lookup.php')) {
          if (parsed.searchParams.get('familyname') === 'Jansen') {
            return new Response(fixture('skater_lookup_multiple.xml'), { headers: { 'content-type': 'application/xml' } })
          }
          return new Response(fixture('skater_lookup.xml'), { headers: { 'content-type': 'application/xml' } })
        }
        throw new Error(`unexpected fetch: ${url}`)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('looks up a skater by name via the XML API', async () => {
    const skater = await ssrLookupSkaterId('Remco', 'Land')
    expect(skater).toMatchObject({ id: '121536', givenname: 'Remco', familyname: 'Land', country: 'NED' })
  })

  it('disambiguates same-name matches using the real <suffix> (birth year) field', async () => {
    await expect(ssrLookupSkaterId('Erik', 'Jansen')).rejects.toThrow(
      'Meerdere SSR schaatsers gevonden: Erik Jansen (1963) (NED, id 9413), Erik Jansen (1977) (NED, id 120381), Erik Jansen (1990) (NED, id 49141)',
    )
  })
})

describe('extractSsrResultsForSkater (against real captured fixtures, issue #7)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url)
        if (parsed.pathname.endsWith('skater_results.php')) {
          if (parsed.searchParams.get('skater') !== '121536' || parsed.searchParams.get('season') !== '2025') {
            return new Response(JSON.stringify({ results: [] }))
          }
          const distance = parsed.searchParams.get('distance')
          if (distance === '500') return new Response(fixture('results_500.json'))
          if (distance === '1000') return new Response(fixture('results_1000.json'))
          if (distance === '1500') return new Response(fixture('results_1500.json'))
          // Real season-2025 responses for 100/300/3000/5000/10000 were also
          // captured empty for this skater.
          return new Response(JSON.stringify({ results: [] }))
        }
        throw new Error(`unexpected fetch: ${url}`)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('aggregates competitions across distances, grouping same-event races by link event id', async () => {
    const parsed = await extractSsrResultsForSkater('121536', '2025')
    // 500m: SoftELS(15-03), Olden.(22-02), Tjas/GSSK(08-03), Tjas(17-01), Collalbo(17-12), Tjas(29-11) = 6
    // 1000m: SoftELS(15-03, same event as the 500m row -> merges), Olden.(22-02, same event) = 0 new
    // 1500m: NSK Allround(11-01) = 1 new
    expect(parsed.competitions).toHaveLength(7)

    const softels = parsed.competitions.find((c) => c.date === '2026-03-15')!
    expect(softels.name).toBe('SoftELS IUT 2026')
    expect(softels.venue).toBe('Heerenveen (NED)')
    expect(softels.results).toHaveLength(2)
    const race500 = softels.results.find((r) => r.distanceM === 500)!
    expect(race500).toMatchObject({ totalTimeMs: 55400, status: 'finished' })
    // SSR results never carry lap splits.
    const race1000 = softels.results.find((r) => r.distanceM === 1000)!
    expect(race1000).toMatchObject({ totalTimeMs: 112970, status: 'finished' })

    const collalbo = parsed.competitions.find((c) => c.date === '2025-12-17')!
    expect(collalbo.venue).toBe('Collalbo (ITA)')
    expect(collalbo.results).toHaveLength(1)
    expect(collalbo.results[0]).toMatchObject({ distanceM: 500, totalTimeMs: 60280 })
  })

  it('throws a clear error when the season (correctly expressed as a startjaar) has no results', async () => {
    // season=2026 is the reported repro from issue #7 -- but for this
    // skater, 2026 genuinely has zero results: their March-2026 races
    // belong to the 2025/2026 season, i.e. Seizoen/season "2025". This is
    // OSTA/SSR's startjaar convention working as intended, not a bug.
    await expect(extractSsrResultsForSkater('121536', '2026')).rejects.toThrow(
      'Geen SpeedSkatingResults-uitslagen gevonden voor deze schaatser en dit seizoen.',
    )
  })
})
