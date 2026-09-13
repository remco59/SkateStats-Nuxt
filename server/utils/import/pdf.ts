import { parseTimeToMs } from '../time'
import { norm } from '../text'

/**
 * KNSB paired-lane PDF result-sheet parser.
 *
 * Operates on already-extracted per-page TEXT, not raw PDF bytes -- the
 * API route does bytes -> text via pdf-parse, then hands the page texts
 * here. This split is deliberate: it lets tests exercise the parsing
 * logic against reference/fixtures/pdf/sample_sheet.txt directly.
 *
 * The block/header layout below was reverse-engineered from a real KNSB
 * "Rituitslag" PDF run through pdf-parse (see
 * https://github.com/remco59/SkateStats-Nuxt/issues/7). It replaced an
 * earlier version written against a hand-built synthetic fixture, which
 * assumed a materially different (and, it turned out, wrong) line layout:
 * a literal "Naam Cat PR Tijd Info" header immediately followed by the two
 * skater lines, each carrying both a PR value and a time value. Real
 * pdf-parse output for this sheet type looks like this per pair (blank
 * lines omitted, one line per array entry):
 *
 *   wt 82 Anna Steenpoorte DN2 57.53      <- lane, bib, name, cat, [PR]
 *   rd 89 Remco Land HN4 56.50            <- second lane (or just "rd" if empty)
 *   25                                    <- pair number
 *   Naam Cat PR Tijd                      <- header (no "Info" on this line)
 *   100m 14.93 (14.93)                    <- skater 1 split: total (lap)
 *   500m 57.04 (42.11)                    <- skater 1 split: total (lap)
 *   Anna Steenpoorte Remco Land           <- both full names, divider
 *   100m 13.71 (13.71)                    <- skater 2 split: total (lap)
 *   500m 55.40 (41.69)                    <- skater 2 split: total (lap)
 *   Info
 *   PR                                    <- decorative PR flag(s), not needed for import
 *   PR	57.04                              <- official final result, skater 1
 *   55.40                                 <- official final result, skater 2
 *
 * The official final result for each skater is a token (a time, or a
 * status like DNF/DNS/DSQ/WDR/NC/DQ+reason-code such as "DQT08") that
 * appears, in skater order, somewhere in the lines after "Info" -- not
 * reliably attached to a fixed line offset, so it's found by scanning
 * those lines for exactly as many status/time tokens as there are skaters
 * in the pair.
 *
 * Likewise, competition name/venue/date do NOT sit on the first three
 * lines of the first page (that assumption held for the synthetic
 * fixture, not for a real PDF -- a real ranking/"Uitslag" page starts with
 * a results table, and even a "Rituitslag" page has this metadata at the
 * BOTTOM). Instead they're found by anchoring on the one unambiguous,
 * un-relocatable line: the spelled-out Dutch date ("15 maart 2026"). Its
 * two neighboring lines are the venue (matches "X - Y") and the
 * competition name (whichever neighbor isn't the venue) -- this holds
 * regardless of which side each lands on, which differs between page
 * types.
 */

const PDF_LANE_MAP: Record<string, string> = { gl: 'Binnen', wt: 'Binnen', bl: 'Buiten', rd: 'Buiten' }
const PDF_STATUS_TOKEN_RE = /^(DNF|DNS|DSQ|DQ[A-Z0-9]*|WDR|NC)$/i
const PDF_TIME_TOKEN_RE = /^\d{1,2}:\d{2}\.\d{2}$|^\d{1,3}\.\d{2}$/

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

const DATE_LINE_NL_RE = new RegExp(`^\\d{1,2}\\s+(${Object.keys(MONTHS_NL).join('|')})\\s+\\d{4}$`, 'i')

/** Ported from parse_date_any: YYYY-MM-DD, D(D)-M(M)-YYYY, D(D)/M(M)/YYYY, or "29 november 2025" (NL). */
export function parseDateAny(s: string): string {
  const value = s.trim()
  if (!value) throw new Error('empty date')

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  let m = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`

  m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`

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

export interface PdfCompetitionMeta {
  name: string
  venue: string | null
  date: string
}

/**
 * Finds the competition name/venue/date by anchoring on the spelled-out
 * Dutch date line, which -- unlike the name and venue -- always appears on
 * its own line in a fixed, unambiguous format. See the module comment for
 * why fixed line offsets from the top of the page don't work.
 */
export function findPdfCompetitionMeta(pageTexts: string[]): PdfCompetitionMeta | null {
  const isVenueLike = (line: string): boolean => /^[^\d]+ - [^\d]+$/.test(line) && line.length < 80

  for (const pageText of pageTexts) {
    const lines = (pageText ?? '').split('\n').map((l) => l.trim())
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      if (!DATE_LINE_NL_RE.test(line)) continue

      const date = parseDateAny(line)
      const prev = lines[i - 1] ?? ''
      const next = lines[i + 1] ?? ''

      let venueLine: string | null = null
      let nameLine: string

      if (isVenueLike(prev)) {
        venueLine = prev
        nameLine = next
      } else if (isVenueLike(next)) {
        venueLine = next
        nameLine = prev
      } else {
        nameLine = prev || next
      }

      if (!nameLine) continue
      return {
        name: cleanCompetitionName(nameLine) || nameLine,
        venue: venueLine ? normalizePdfVenue(venueLine) : null,
        date,
      }
    }
  }

  return null
}

interface PdfLaneSlot {
  laneCode: string
  bib: string | null
  name: string | null
  cat: string | null
}

/** A pair's two lanes: `gl`+`bl` ("Binnen"/"Buiten" indoors) or `wt`+`rd` (outdoors). */
export function parsePdfLaneLine(line: string): PdfLaneSlot | null {
  const trimmed = (line ?? '').trim()

  const bioMatch = trimmed.match(/^(gl|bl|wt|rd)\s+(\d+)\s+(.+?)\s+([A-Z][A-Z0-9]{1,5})(?:\s+[0-9:.]+)?$/i)
  if (bioMatch) {
    return { laneCode: bioMatch[1]!.toLowerCase(), bib: bioMatch[2]!, name: bioMatch[3]!.trim(), cat: bioMatch[4]! }
  }

  // A lane with no skater renders as just the bare lane code.
  const emptyMatch = trimmed.match(/^(gl|bl|wt|rd)$/i)
  if (emptyMatch) return { laneCode: emptyMatch[1]!.toLowerCase(), bib: null, name: null, cat: null }

  return null
}

interface PdfSkaterOutcome {
  /** The raw token from the Info section: a time string, or a status like "DNF"/"DQT08". */
  token: string
  isStatus: boolean
  /** Lap (segment) time strings, in split order, e.g. ["14.93", "42.11"]. */
  laps: string[]
  /** Distance of the last split seen for this skater, if any. */
  distanceM: number | null
}

interface PdfPairBlock {
  pairNo: number
  slots: [PdfLaneSlot, PdfLaneSlot]
  results: [PdfSkaterOutcome | null, PdfSkaterOutcome | null]
}

export function extractPdfPairBlocks(pageText: string): PdfPairBlock[] {
  const lines = (pageText ?? '').split('\n').map((l) => l.trim())
  const blocks: PdfPairBlock[] = []
  let idx = 0

  while (idx < lines.length) {
    const slotA = parsePdfLaneLine(lines[idx]!)
    if (!slotA) {
      idx += 1
      continue
    }
    const slotB = parsePdfLaneLine(lines[idx + 1] ?? '')
    if (!slotB) {
      idx += 1
      continue
    }
    const pairLine = (lines[idx + 2] ?? '').trim()
    if (!/^\d+$/.test(pairLine)) {
      idx += 1
      continue
    }
    if ((lines[idx + 3] ?? '').trim() !== 'Naam Cat PR Tijd') {
      idx += 1
      continue
    }

    const slots: [PdfLaneSlot, PdfLaneSlot] = [slotA, slotB]
    const presentSlots = [0, 1].filter((i) => slots[i]!.name)

    // Splits appear as two runs of "<dist>m <total> (<lap>)" lines -- one
    // per present skater -- separated by a non-split divider line (the
    // repeated skater name(s)).
    const chunks: { distanceM: number; lap: string }[][] = [[], []]
    let chunkIndex = 0
    let cursor = idx + 4
    let infoIdx = -1
    let hitNextBlock = false

    while (cursor < lines.length) {
      const line = lines[cursor]!
      if (line === 'Info') {
        infoIdx = cursor
        break
      }
      if (parsePdfLaneLine(line)) {
        hitNextBlock = true
        break
      }
      const splitMatch = line.match(/^(\d+)m\s+([0-9:.]+)\s+\(([0-9:.]+)\)$/)
      if (splitMatch) {
        chunks[chunkIndex]!.push({ distanceM: Number.parseInt(splitMatch[1]!, 10), lap: splitMatch[3]! })
      } else if (line.length && chunkIndex === 0 && chunks[0]!.length) {
        chunkIndex = 1
      }
      cursor += 1
    }

    if (hitNextBlock || infoIdx === -1) {
      idx += 1
      continue
    }

    // The official result for each present skater is a status/time token,
    // in skater order, found by scanning the lines after "Info".
    const maxTokens = presentSlots.length
    const tokens: { value: string; isStatus: boolean }[] = []
    let tokenCursor = infoIdx + 1
    while (tokenCursor < lines.length && tokens.length < maxTokens) {
      const line = lines[tokenCursor]!
      if (parsePdfLaneLine(line)) break
      for (const part of line.split(/\s+/).filter(Boolean)) {
        if (PDF_STATUS_TOKEN_RE.test(part)) tokens.push({ value: part.toUpperCase(), isStatus: true })
        else if (PDF_TIME_TOKEN_RE.test(part)) tokens.push({ value: part, isStatus: false })
        if (tokens.length >= maxTokens) break
      }
      tokenCursor += 1
    }

    if (!maxTokens || tokens.length < maxTokens) {
      idx += 1
      continue
    }

    const results: [PdfSkaterOutcome | null, PdfSkaterOutcome | null] = [null, null]
    presentSlots.forEach((slotIdx, i) => {
      const chunk = chunks[i] ?? []
      const token = tokens[i]!
      results[slotIdx] = {
        token: token.value,
        isStatus: token.isStatus,
        laps: chunk.map((c) => c.lap),
        distanceM: chunk.length ? chunk[chunk.length - 1]!.distanceM : null,
      }
    })

    blocks.push({ pairNo: Number.parseInt(pairLine, 10), slots, results })
    idx = tokenCursor
  }

  return blocks
}

function classifyStatusToken(token: string): Exclude<PdfResult['status'], 'finished'> {
  const upper = token.toUpperCase()
  if (upper === 'DNF') return 'dnf'
  if (upper === 'DNS') return 'dns'
  if (upper === 'DSQ') return 'dsq'
  if (upper === 'WDR') return 'wdr'
  if (upper === 'NC') return 'nc'
  return 'dq' // covers "DQ" and reason-coded variants like "DQT08"
}

/** Distance of the race this page's pairs are skating, e.g. from "1. Rituitslag Buiten mededinging - 500 meter". */
function extractPdfPageDistance(pageText: string): number | null {
  const match = (pageText ?? '').match(/\b(\d+)\s*meter\b/i)
  return match ? Number.parseInt(match[1]!, 10) : null
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

  const meta = findPdfCompetitionMeta(nonEmptyPages)
  if (!meta) throw new Error('Kon wedstrijdgegevens niet uit de PDF-header halen.')

  const targetNorm = norm(targetName)
  const competitionsByDate = new Map<string, PdfParsedCompetition>()
  let lastPageDate: string | null = meta.date

  for (const text of nonEmptyPages) {
    const pageDate = extractPdfPageDate(text, lastPageDate)
    if (pageDate) lastPageDate = pageDate
    const pageDistanceM = extractPdfPageDistance(text)

    for (const block of extractPdfPairBlocks(text)) {
      const matchIndex = block.slots.findIndex((s) => s.name && norm(s.name) === targetNorm)
      if (matchIndex < 0) continue

      const ownResult = block.results[matchIndex]
      if (!ownResult) continue
      const opponentSlot = block.slots[1 - matchIndex]!
      const opponentResult = block.results[1 - matchIndex]

      let totalTimeMs: number | null
      let status: PdfResult['status']
      if (ownResult.isStatus) {
        totalTimeMs = null
        status = classifyStatusToken(ownResult.token)
      } else {
        try {
          totalTimeMs = parseTimeToMs(ownResult.token)
        } catch {
          continue
        }
        status = 'finished'
      }

      const lapsMs = ownResult.laps.length
        ? ownResult.laps.map((lap) => {
            try {
              return parseTimeToMs(lap)
            } catch {
              return null
            }
          })
        : []
      const validLapsMs = lapsMs.every((v): v is number => v !== null) ? (lapsMs as number[]) : null

      const laneValue = PDF_LANE_MAP[block.slots[matchIndex]!.laneCode] ?? block.slots[matchIndex]!.laneCode.toUpperCase()
      const opponentName = opponentSlot.name && !opponentResult?.isStatus ? opponentSlot.name : ''

      const raceDate = pageDate || meta.date
      if (!raceDate) continue

      const distanceM = ownResult.distanceM ?? pageDistanceM
      if (!distanceM) continue

      let competitionItem = competitionsByDate.get(raceDate)
      if (!competitionItem) {
        competitionItem = {
          name: meta.name,
          date: raceDate,
          venue: meta.venue,
          notes: `Geimporteerd van PDF: ${sourceFilename.trim() || 'uitslag PDF'}`,
          results: [],
        }
        competitionsByDate.set(raceDate, competitionItem)
      }

      const sourceHint = sourceFilename.trim() || 'PDF uitslag'
      competitionItem.results.push({
        pairNo: block.pairNo,
        distanceM,
        lane: laneValue,
        opponent: opponentName,
        totalTimeMs,
        status,
        lapsMs: validLapsMs?.length ? validLapsMs : null,
        notes: `Geimporteerd van PDF: ${sourceHint}`,
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
