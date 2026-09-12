import { parseTimeToMs } from '../time'
import { norm } from '../text'

/**
 * KNSB paired-lane PDF result-sheet parser, ported from app/main.py (old
 * app, commit 4dc6959): parse_pdf_skater_line, parse_pdf_timing_line,
 * active_pdf_timing_index, extract_pdf_pair_blocks, extract_pdf_page_date,
 * extract_pdf_results_for_skater, clean_competition_name,
 * normalize_pdf_venue, extract_date_from_text, parse_date_any (Dutch
 * month names).
 *
 * Operates on already-extracted per-page TEXT, not raw PDF bytes -- the
 * API route does bytes -> text via pdf-parse, then hands the page texts
 * here. This split is deliberate: it lets tests exercise the parsing
 * logic against reference/fixtures/pdf/sample_sheet.txt directly.
 *
 * KNOWN RISK, not yet resolved (see REBUILD_PLAN.md section 8's PDF
 * go/no-go check): the block-pairing algorithm depends on fixed line
 * offsets, which assumes pdf-parse emits lines in the same order
 * pdfplumber did for the old app. This has been verified against the
 * synthetic text fixture (which is hand-built to match the expected
 * shape) but NOT against a real PDF run through pdf-parse, because this
 * environment has no real KNSB result-sheet PDF to test with. Treat the
 * first real PDF import as the actual go/no-go check, and expect to
 * adjust extractPdfPairBlocks's line offsets if pdf-parse's line order
 * differs.
 */

const PDF_LANE_MAP: Record<string, string> = { gl: 'Binnen', wt: 'Binnen', bl: 'Buiten', rd: 'Buiten' }
const PDF_STATUS_VALUES = new Set(['DNF', 'DNS', 'DSQ', 'DQ', 'WDR', 'NC'])

const MONTHS_NL: Record<string, number> = {
  januari: 1,
  februari: 2,
  maart: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  augustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  december: 12,
}

/** Ported from parse_date_any: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, or "29 november 2025" (NL). */
export function parseDateAny(s: string): string {
  const value = s.trim()
  if (!value) throw new Error('empty date')

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  let m = value.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`

  m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`

  m = value.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})$/)
  if (m) {
    const day = Number.parseInt(m[1]!, 10)
    const month = MONTHS_NL[m[2]!.toLowerCase()]
    const year = Number.parseInt(m[3]!, 10)
    if (month) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  throw new Error(`invalid date: ${s}`)
}

export function extractDateFromText(s: string): string | null {
  const text = s.trim()
  if (!text) return null

  const candidates = [
    text,
    ...(text.match(/\d{4}-\d{2}-\d{2}/g) ?? []),
    ...(text.match(/\d{1,2}-\d{1,2}-\d{4}/g) ?? []),
    ...(text.match(/\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4}/gi) ?? []),
  ]

  for (const candidate of candidates) {
    try {
      return parseDateAny(candidate)
    } catch {
      continue
    }
  }
  return null
}

export function cleanCompetitionName(s: string): string {
  let value = s.trim()
  if (!value) return value

  value = value.replace(/\buitslag\b/gi, '')
  value = value.replace(/\d{4}-\d{2}-\d{2}/g, '')
  value = value.replace(/\d{1,2}-\d{1,2}-\d{4}/g, '')
  value = value.replace(/\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4}/gi, '')
  value = value.replace(/\s+-\s+/g, ' ')
  value = value.replace(/\s+/g, ' ')
  return value.trim().replace(/^[\s-]+|[\s-]+$/g, '')
}

export function normalizePdfVenue(rawValue: string): string | null {
  let value = rawValue.trim()
  if (!value) return null
  if (value.includes(' - ')) value = value.split(' - ', 2)[1]!.trim()
  if (/\([A-Z]{3}\)\s*$/.test(value)) return value
  return `${value} (NED)`
}

interface PdfSkaterLine {
  laneCode: string
  name: string
  cat: string
  pr: string
  time: string
}

export function parsePdfSkaterLine(line: string): PdfSkaterLine | null {
  const match = (line ?? '')
    .trim()
    .match(/^(gl|bl|wt|rd)\s+\d+\s+(.+?)\s+([A-Z][A-Z0-9]{1,5})\s+([0-9:.]+)\s+([0-9:.]+|DNF|DNS|DSQ|DQ|WDR|NC)\b/i)
  if (!match) return null
  return {
    laneCode: match[1]!.toLowerCase(),
    name: match[2]!.trim(),
    cat: match[3]!.trim(),
    pr: match[4]!.trim(),
    time: match[5]!.trim(),
  }
}

type PdfTimingLine =
  | { distanceM: number; totals: [string, string]; laps: [string, string] }
  | { distanceM: number; singleTotal: string; singleLap: string }

export function parsePdfTimingLine(line: string): PdfTimingLine | null {
  const trimmed = (line ?? '').trim()

  const dual = trimmed.match(/^(\d+)m\s+([0-9:.]+)\s+\(([0-9:.]+)\)\s+(\d+)m\s+([0-9:.]+)\s+\(([0-9:.]+)\)$/)
  if (dual) {
    return {
      distanceM: Number.parseInt(dual[1]!, 10),
      totals: [dual[2]!.trim(), dual[5]!.trim()],
      laps: [dual[3]!.trim(), dual[6]!.trim()],
    }
  }

  const single = trimmed.match(/^(\d+)m\s+([0-9:.]+)\s+\(([0-9:.]+)\)$/)
  if (single) {
    return { distanceM: Number.parseInt(single[1]!, 10), singleTotal: single[2]!.trim(), singleLap: single[3]!.trim() }
  }

  return null
}

function activePdfTimingIndex(skaters: PdfSkaterLine[]): number | null {
  const candidates: number[] = []
  skaters.forEach((skater, idx) => {
    const rawTime = (skater.time ?? '').trim().toUpperCase()
    if (rawTime && !PDF_STATUS_VALUES.has(rawTime)) candidates.push(idx)
  })
  return candidates.length === 1 ? candidates[0]! : null
}

interface PdfPairBlock {
  pairNo: number
  skaters: [PdfSkaterLine, PdfSkaterLine]
  timings: { distanceM: number; totals: [string | null, string | null]; laps: [string | null, string | null] }[]
}

export function extractPdfPairBlocks(pageText: string): PdfPairBlock[] {
  const lines = (pageText ?? '').split('\n').map((l) => l.trim())
  const blocks: PdfPairBlock[] = []
  let idx = 0

  while (idx < lines.length) {
    if (lines[idx] !== 'Naam Cat PR Tijd Info') {
      idx += 1
      continue
    }
    if (idx + 6 >= lines.length) break

    const first = parsePdfSkaterLine(lines[idx + 1]!)
    const second = parsePdfSkaterLine(lines[idx + 3]!)
    const pairLine = lines[idx + 2]!
    if (!first || !second || !/^\d+$/.test(pairLine)) {
      idx += 1
      continue
    }

    const skaters: [PdfSkaterLine, PdfSkaterLine] = [first, second]
    const activeIndex = activePdfTimingIndex(skaters)
    const timingRows: PdfPairBlock['timings'] = []
    // The line right after the second skater (idx+4) is USUALLY a
    // header/blank line to skip -- but real pdf-parse output can omit
    // blank lines entirely, in which case idx+4 is already the first real
    // timing row. Verified against a real PDF generated from this fixture
    // (not just the synthetic text file): unconditionally skipping idx+4,
    // as the old app does, silently dropped that row's split data. Only
    // skip it if it does NOT parse as a timing line.
    let cursor = idx + 4
    if (!parsePdfTimingLine(lines[cursor]!)) {
      cursor += 1
    }

    while (cursor < lines.length) {
      const parsedTiming = parsePdfTimingLine(lines[cursor]!)
      if (!parsedTiming) break

      if ('singleTotal' in parsedTiming) {
        if (activeIndex === null) {
          cursor += 1
          continue
        }
        const totals: [string | null, string | null] = [null, null]
        const laps: [string | null, string | null] = [null, null]
        totals[activeIndex] = parsedTiming.singleTotal
        laps[activeIndex] = parsedTiming.singleLap
        timingRows.push({ distanceM: parsedTiming.distanceM, totals, laps })
      } else {
        timingRows.push({ distanceM: parsedTiming.distanceM, totals: parsedTiming.totals, laps: parsedTiming.laps })
      }
      cursor += 1
    }

    if (timingRows.length) {
      blocks.push({ pairNo: Number.parseInt(pairLine, 10), skaters, timings: timingRows })
      idx = cursor
      continue
    }

    idx += 1
  }

  return blocks
}

export function extractPdfPageDate(pageText: string, fallbackDate: string | null = null): string | null {
  const text = pageText ?? ''
  const vanMatch = text.match(/\bVan\s+(\d{1,2}-\d{1,2}-\d{4})\b/i)
  if (vanMatch) {
    try {
      return parseDateAny(vanMatch[1]!)
    } catch {
      // fall through
    }
  }

  for (const candidate of text.match(/\b\d{1,2}-\d{1,2}-\d{4}\b/g) ?? []) {
    try {
      return parseDateAny(candidate)
    } catch {
      continue
    }
  }

  return fallbackDate
}

export interface PdfResult {
  pairNo: number
  distanceM: number
  lane: string
  opponent: string
  totalTimeMs: number | null
  status: 'finished' | 'dnf' | 'dns' | 'dsq' | 'dq' | 'wdr' | 'nc'
  lapsMs: number[] | null
  notes: string
}

export interface PdfParsedCompetition {
  name: string
  venue: string | null
  date: string
  notes: string
  results: PdfResult[]
}

/** `pageTexts` = one already-extracted plain-text string per PDF page (see the module comment). */
export function extractPdfResultsForSkater(
  pageTexts: string[],
  skaterName: string,
  sourceFilename = '',
): { competitions: PdfParsedCompetition[] } {
  const targetName = skaterName.trim()
  if (!targetName) throw new Error('Geen schaatsersnaam ingesteld om in de PDF te zoeken.')

  const nonEmptyPages = pageTexts.map((t) => (t ?? '').trim()).filter((t) => t.length)
  if (!nonEmptyPages.length) throw new Error('PDF bevat geen leesbare tekst.')

  const headerLines = nonEmptyPages[0]!
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length)
  if (headerLines.length < 3) throw new Error('Kon wedstrijdgegevens niet uit de PDF-header halen.')

  const competitionNameRaw = headerLines[0]!
  const competitionName = cleanCompetitionName(competitionNameRaw) || competitionNameRaw
  const headerDate = extractDateFromText(headerLines[2]!)
  const competitionVenue = normalizePdfVenue(headerLines[1]!)

  const targetNorm = norm(targetName)
  const competitionsByDate = new Map<string, PdfParsedCompetition>()
  let lastPageDate = headerDate

  for (const text of nonEmptyPages) {
    const pageDate = extractPdfPageDate(text, lastPageDate)
    if (pageDate) lastPageDate = pageDate

    for (const block of extractPdfPairBlocks(text)) {
      const matchIndex = block.skaters.findIndex((s) => norm(s.name) === targetNorm)
      if (matchIndex < 0) continue

      const ownSkater = block.skaters[matchIndex]!
      const opponent = block.skaters[1 - matchIndex]!
      const finalTiming = block.timings[block.timings.length - 1]!
      const totalRaw = finalTiming.totals[matchIndex] || ownSkater.time
      const totalUpper = totalRaw.toUpperCase()

      let totalTimeMs: number | null
      let status: PdfResult['status']
      if (PDF_STATUS_VALUES.has(totalUpper)) {
        totalTimeMs = null
        status = totalUpper.toLowerCase() as PdfResult['status']
      } else {
        try {
          totalTimeMs = parseTimeToMs(totalRaw)
        } catch {
          continue
        }
        status = 'finished'
      }

      const lapValues: number[] = []
      for (const timing of block.timings) {
        const lapRaw = timing.laps[matchIndex]
        if (!lapRaw) continue
        try {
          lapValues.push(parseTimeToMs(lapRaw))
        } catch {
          continue
        }
      }

      const laneValue = PDF_LANE_MAP[ownSkater.laneCode] ?? ownSkater.laneCode.toUpperCase()
      let opponentName = opponent.name
      if (PDF_STATUS_VALUES.has((opponent.time ?? '').trim().toUpperCase())) opponentName = ''

      const sourceHint = sourceFilename.trim()
      const sourceText = sourceHint || 'PDF uitslag'
      const raceDate = pageDate || headerDate
      if (!raceDate) continue

      let competitionItem = competitionsByDate.get(raceDate)
      if (!competitionItem) {
        competitionItem = {
          name: competitionName,
          date: raceDate,
          venue: competitionVenue,
          notes: `Geimporteerd van PDF: ${sourceFilename.trim() || 'uitslag PDF'}`,
          results: [],
        }
        competitionsByDate.set(raceDate, competitionItem)
      }

      competitionItem.results.push({
        pairNo: block.pairNo,
        distanceM: finalTiming.distanceM,
        lane: laneValue,
        opponent: opponentName,
        totalTimeMs,
        status,
        lapsMs: lapValues.length ? lapValues : null,
        notes: `Geimporteerd van PDF: ${sourceText}`,
      })
    }
  }

  const competitions = [...competitionsByDate.keys()]
    .sort()
    .map((key) => competitionsByDate.get(key)!)
    .filter((c) => c.results.length)

  if (!competitions.length) {
    throw new Error(`Geen ritten gevonden voor '${targetName}' in deze PDF.`)
  }

  for (const item of competitions) {
    item.results.sort((a, b) => (a.pairNo !== b.pairNo ? a.pairNo - b.pairNo : a.distanceM - b.distanceM))
  }

  return { competitions }
}
