import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  cleanCompetitionName,
  extractDateFromText,
  extractPdfPageDate,
  extractPdfPairBlocks,
  extractPdfResultsForSkater,
  findPdfCompetitionMeta,
  normalizePdfVenue,
  parseDateAny,
} from '../../server/utils/import/pdf'
import golden from '../../reference/fixtures/calculations/golden_calculations.json'

const g = golden.pdf_parsing
const sampleSheet = readFileSync(join(__dirname, '../../reference/fixtures/pdf/sample_sheet.txt'), 'utf-8')

describe('PDF result-sheet parsing (golden fixture, real pdf-parse output)', () => {
  it('parseDateAny handles NL month names and unpadded numeric dates', () => {
    expect(parseDateAny('29 november 2025')).toBe('2025-11-29')
    expect(parseDateAny('11-01-2025')).toBe('2025-01-11')
    expect(parseDateAny('15-3-2026')).toBe('2026-03-15')
    expect(parseDateAny('5-3-2026')).toBe('2026-03-05')
    expect(parseDateAny('2025-01-11')).toBe('2025-01-11')
  })

  it('finds competition name/venue/date by anchoring on the spelled-out date line, not fixed offsets', () => {
    const meta = findPdfCompetitionMeta([sampleSheet])
    expect(meta).not.toBeNull()
    expect(meta!.name).toBe(g.expected_header.competition_name)
    expect(meta!.venue).toBe(g.expected_header.venue)
    expect(meta!.date).toBe(g.expected_header.date)
  })

  it('extractDateFromText / extractPdfPageDate still work standalone', () => {
    expect(extractDateFromText('15 maart 2026')).toBe('2026-03-15')
    expect(extractPdfPageDate(sampleSheet, null)).toBe('2026-03-15')
  })

  it('cleanCompetitionName / normalizePdfVenue are unchanged', () => {
    expect(cleanCompetitionName('SoftELS IUT 2026')).toBe('SoftELS IUT 2026')
    expect(normalizePdfVenue('Thialf - Heerenveen')).toBe('Heerenveen (NED)')
  })

  it('extracts every pair block on the page, including the target pair', () => {
    const blocks = extractPdfPairBlocks(sampleSheet)
    expect(blocks).toHaveLength(5)

    const block = blocks.find((b) => b.pairNo === g.expected_pair_block.pair_no)!
    expect(block.slots[0]).toMatchObject({
      laneCode: g.expected_pair_block.skaters[0]!.lane_code,
      bib: g.expected_pair_block.skaters[0]!.bib,
      name: g.expected_pair_block.skaters[0]!.name,
      cat: g.expected_pair_block.skaters[0]!.cat,
    })
    expect(block.slots[1]).toMatchObject({
      laneCode: g.expected_pair_block.skaters[1]!.lane_code,
      bib: g.expected_pair_block.skaters[1]!.bib,
      name: g.expected_pair_block.skaters[1]!.name,
      cat: g.expected_pair_block.skaters[1]!.cat,
    })
    expect(block.results[0]).toEqual({
      token: g.expected_pair_block.results[0]!.token,
      isStatus: g.expected_pair_block.results[0]!.is_status,
      laps: g.expected_pair_block.results[0]!.laps,
      distanceM: g.expected_pair_block.results[0]!.distance_m,
    })
    expect(block.results[1]).toEqual({
      token: g.expected_pair_block.results[1]!.token,
      isStatus: g.expected_pair_block.results[1]!.is_status,
      laps: g.expected_pair_block.results[1]!.laps,
      distanceM: g.expected_pair_block.results[1]!.distance_m,
    })
  })

  it('extractPdfResultsForSkater finds the reported skater (Remco Land) -- regression for #7', () => {
    const parsed = extractPdfResultsForSkater([sampleSheet], 'Remco Land', 'SoftELS_IUT_2026 - uitslag.pdf')
    expect(parsed.competitions).toHaveLength(1)
    const competition = parsed.competitions[0]!
    expect(competition.name).toBe(g.expected_header.competition_name)
    expect(competition.date).toBe(g.expected_header.date)
    expect(competition.venue).toBe(g.expected_header.venue)

    const result = competition.results[0]!
    const expected = g.expected_result_for_remco_land
    expect(result.pairNo).toBe(expected.pair_no)
    expect(result.distanceM).toBe(expected.distance_m)
    expect(result.lane).toBe(expected.lane)
    expect(result.opponent).toBe(expected.opponent)
    expect(result.totalTimeMs).toBe(expected.total_time_ms)
    expect(result.status).toBe(expected.status)
    expect(result.lapsMs).toEqual(expected.laps_ms)
  })

  it('finds the opponent skater symmetrically', () => {
    const parsed = extractPdfResultsForSkater([sampleSheet], 'Anna Steenpoorte', 'SoftELS_IUT_2026 - uitslag.pdf')
    const result = parsed.competitions[0]!.results[0]!
    const expected = g.expected_result_for_anna_steenpoorte
    expect(result.opponent).toBe(expected.opponent)
    expect(result.lane).toBe(expected.lane)
    expect(result.totalTimeMs).toBe(expected.total_time_ms)
    expect(result.lapsMs).toEqual(expected.laps_ms)
  })

  it('is case/whitespace-insensitive on the skater name', () => {
    const parsed = extractPdfResultsForSkater([sampleSheet], '  remco   land ', 'uitslag.pdf')
    expect(parsed.competitions[0]!.results[0]!.totalTimeMs).toBe(55400)
  })

  it('throws a not-found error for a skater absent from the sheet', () => {
    expect(() => extractPdfResultsForSkater([sampleSheet], 'Nonexistent Skater', 'uitslag.pdf')).toThrow(
      "Geen ritten gevonden voor 'Nonexistent Skater' in deze PDF.",
    )
  })
})

describe('PDF pair-block edge cases (DQ, withdrawal, solo lane, empty pair) -- real pdf-parse layout', () => {
  const dqAndWdrPage = [
    '3. Rituitslag Categorie B - 500 meter',
    'gl 77 Monique Sminia DSB 1:28.94',
    'bl 84 Valerie Buss DN3 1:14.43',
    '12',
    'Naam Cat PR Tijd',
    '100m 20.27 (20.27)',
    '500m 1:25.25 (64.98)',
    'Monique Sminia Valerie Buss',
    '100m 18.21 (18.21)',
    '500m 1:15.22 (57.01)',
    'Info',
    'DQT08',
    '1:15.22',
    'wt 71 Robin Geesken DSA 51.96',
    'rd 10 Sarah Reijke DN3 51.37',
    '13',
    'Naam Cat PR Tijd',
    '100m 13.80 (13.80)',
    '500m 51.05 (37.25)',
    'Robin Geesken Sarah Reijke',
    'Info',
    'PR\t51.05',
    'WDR',
    'wt 61 Theresa Siepe DSA',
    'rd',
    '14',
    'Naam Cat PR Tijd',
    '100m 16.66 (16.66)',
    '500m 1:05.80 (49.14)',
    'Theresa Siepe',
    'm',
    'Info',
    '1:05.80',
    'gl',
    'bl',
    '15',
    'Naam Cat PR Tijd',
    'm m',
    'Info',
    'Thialf - Heerenveen',
    '15 maart 2026',
    'SoftELS IUT 2026',
    'Van 15-3-2026 16:30:00 tot 15-3-2026 18:16:56 Print: 13-9-2026 16:00:09',
    'Scheidsrechter: Boris Petersen Assistent: Starter: Henk Beursgens',
  ].join('\n')

  it('reads a disqualification token (with reason code) as a status, not a time', () => {
    const blocks = extractPdfPairBlocks(dqAndWdrPage)
    const pair12 = blocks.find((b) => b.pairNo === 12)!
    expect(pair12.results[0]).toMatchObject({ token: 'DQT08', isStatus: true })
    expect(pair12.results[1]).toMatchObject({ token: '1:15.22', isStatus: false })

    const parsed = extractPdfResultsForSkater([dqAndWdrPage], 'Monique Sminia', 'uitslag.pdf')
    const result = parsed.competitions[0]!.results[0]!
    expect(result.status).toBe('dq')
    expect(result.totalTimeMs).toBeNull()
  })

  it('blanks the opponent name when the opponent withdrew', () => {
    const parsed = extractPdfResultsForSkater([dqAndWdrPage], 'Robin Geesken', 'uitslag.pdf')
    const result = parsed.competitions[0]!.results[0]!
    expect(result.status).toBe('finished')
    expect(result.totalTimeMs).toBe(51050)
    expect(result.opponent).toBe('')

    const sarahParsed = extractPdfResultsForSkater([dqAndWdrPage], 'Sarah Reijke', 'uitslag.pdf')
    const sarahResult = sarahParsed.competitions[0]!.results[0]!
    expect(sarahResult.status).toBe('wdr')
    expect(sarahResult.totalTimeMs).toBeNull()
  })

  it('handles a solo pair (empty second lane) with no opponent', () => {
    const parsed = extractPdfResultsForSkater([dqAndWdrPage], 'Theresa Siepe', 'uitslag.pdf')
    const result = parsed.competitions[0]!.results[0]!
    expect(result.totalTimeMs).toBe(65800)
    expect(result.opponent).toBe('')
  })

  it('skips a pair with no skaters in either lane', () => {
    const blocks = extractPdfPairBlocks(dqAndWdrPage)
    expect(blocks.some((b) => b.pairNo === 15)).toBe(false)
  })
})
