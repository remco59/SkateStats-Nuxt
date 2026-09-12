import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  cleanCompetitionName,
  extractDateFromText,
  extractPdfPageDate,
  extractPdfPairBlocks,
  extractPdfResultsForSkater,
  normalizePdfVenue,
  parseDateAny,
} from '../../server/utils/import/pdf'
import golden from '../../reference/fixtures/calculations/golden_calculations.json'

const g = golden.pdf_parsing
const sampleSheet = readFileSync(join(__dirname, '../../reference/fixtures/pdf/sample_sheet.txt'), 'utf-8')

describe('PDF result-sheet parsing (golden fixture)', () => {
  it('parseDateAny handles NL month names', () => {
    expect(parseDateAny('29 november 2025')).toBe('2025-11-29')
    expect(parseDateAny('11-01-2025')).toBe('2025-01-11')
    expect(parseDateAny('2025-01-11')).toBe('2025-01-11')
  })

  it('header extraction matches the old app exactly', () => {
    const headerLines = sampleSheet
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length)
      .slice(0, 3)

    expect(cleanCompetitionName(headerLines[0]!) || headerLines[0]).toBe(g.expected_header.competition_name)
    expect(extractDateFromText(headerLines[2]!)).toBe(g.expected_header.header_date)
    expect(normalizePdfVenue(headerLines[1]!)).toBe(g.expected_header.venue)
    expect(extractPdfPageDate(sampleSheet, g.expected_header.header_date)).toBe(g.expected_header.page_date)
  })

  it('extracts the pair block exactly as the old app does', () => {
    const blocks = extractPdfPairBlocks(sampleSheet)
    expect(blocks).toHaveLength(1)
    const block = blocks[0]!
    expect(block.pairNo).toBe(g.expected_pair_block.pair_no)
    expect(block.skaters[0]).toEqual({
      laneCode: g.expected_pair_block.skaters[0]!.lane_code,
      name: g.expected_pair_block.skaters[0]!.name,
      cat: g.expected_pair_block.skaters[0]!.cat,
      pr: g.expected_pair_block.skaters[0]!.pr,
      time: g.expected_pair_block.skaters[0]!.time,
    })
    expect(block.timings).toHaveLength(2)
    expect(block.timings[0]).toEqual({
      distanceM: 500,
      totals: ['40.55', '41.20'],
      laps: ['40.55', '41.20'],
    })
    expect(block.timings[1]).toEqual({
      distanceM: 1000,
      totals: ['1:12.00', '1:14.80'],
      laps: ['31.45', '33.60'],
    })
  })

  it('extractPdfResultsForSkater produces the final race result for the target skater', () => {
    const parsed = extractPdfResultsForSkater([sampleSheet], 'Jansen, Remco', 'uitslag.pdf')
    expect(parsed.competitions).toHaveLength(1)
    const competition = parsed.competitions[0]!
    expect(competition.date).toBe(g.expected_header.page_date)
    expect(competition.venue).toBe(g.expected_header.venue)

    const result = competition.results[0]!
    expect(result.pairNo).toBe(g.expected_result_for_jansen_remco.pair_no)
    expect(result.distanceM).toBe(g.expected_result_for_jansen_remco.distance_m)
    expect(result.lane).toBe(g.expected_result_for_jansen_remco.lane)
    expect(result.opponent).toBe(g.expected_result_for_jansen_remco.opponent)
    expect(result.totalTimeMs).toBe(g.expected_result_for_jansen_remco.total_time_ms)
    expect(result.status).toBe(g.expected_result_for_jansen_remco.status)
    expect(result.lapsMs).toEqual(g.expected_result_for_jansen_remco.laps_ms)
  })

  it('finds the opponent skater symmetrically', () => {
    const parsed = extractPdfResultsForSkater([sampleSheet], 'Pietersen, Joris', 'uitslag.pdf')
    const result = parsed.competitions[0]!.results[0]!
    expect(result.opponent).toBe('Jansen, Remco')
    expect(result.lane).toBe('Buiten')
    expect(result.totalTimeMs).toBe(74800)
  })
})
