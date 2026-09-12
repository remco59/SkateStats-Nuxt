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
    ['40,55', [40550, 'finished']], // comma decimal separator
    ['', [null, 'finished']],
  ] as const)('parses %s', (input, expected) => {
    expect(parseSsrTimeValue(input)).toEqual(expected)
  })
})

describe('SSR scraper (against reference fixtures)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('skater_lookup.php')) {
          return new Response(fixture('skater_lookup.xml'), { headers: { 'content-type': 'application/xml' } })
        }
        if (url.includes('skater_results.php')) {
          const parsed = new URL(url)
          // Only the 1500m fixture has data; every other distance returns empty.
          if (parsed.searchParams.get('distance') === '1500') {
            return new Response(fixture('results.json'))
          }
          return new Response(JSON.stringify({ results: [] }))
        }
        throw new Error(`unexpected fetch: ${url}`)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('looks up a skater by name via the XML API', async () => {
    const skater = await ssrLookupSkaterId('Remco', 'Jansen')
    expect(skater).toMatchObject({ id: '123456', givenname: 'Remco', familyname: 'Jansen', country: 'NED' })
  })

  it('extracts season results, one call per SSR_DISTANCES entry, grouped by competition', async () => {
    const parsed = await extractSsrResultsForSkater('123456', '2024')
    expect(parsed.competitions).toHaveLength(1)
    const competition = parsed.competitions[0]!
    expect(competition.name).toBe('KNSB Bekerwedstrijd Heerenveen')
    expect(competition.venue).toBe('Heerenveen (NED)')
    expect(competition.date).toBe('2024-11-16')
    expect(competition.results).toHaveLength(1)
    expect(competition.results[0]).toMatchObject({ distanceM: 1500, totalTimeMs: 133900, status: 'finished' })
  })
})
