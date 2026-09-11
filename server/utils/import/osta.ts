import * as cheerio from 'cheerio'
import { parseTimeToMs } from '../time'

/**
 * OSTA (osta.nl) scraper, ported from app/main.py (old app, commit
 * 4dc6959): osta_fetch_soup, osta_lookup_candidates, osta_lookup_pid,
 * osta_build_laps_csv, osta_extract_competition_name,
 * extract_osta_results_for_pid, merge_osta_results. Selectors and query
 * params are the portable part (REBUILD_PLAN.md section 4) -- cheerio's
 * selector engine accepts the exact same CSS the old app used with
 * BeautifulSoup. Tested against reference/fixtures/osta/*.html (synthetic,
 * shape-correct fixtures -- see that folder's README for the caveat that
 * these are not captured from live OSTA traffic).
 */

export const OSTA_BASE = 'https://www.osta.nl/'

export interface OstaCandidate {
  pid: string
  name: string
  category: string
  seasons: string
  club: string
}

export interface OstaCompetitionResult {
  distanceM: number
  totalTimeMs: number
  lapsCsv: string | null
  sourceRef: string
}

export interface OstaParsedCompetition {
  name: string
  venue: string | null
  date: string
  sourcePid: string
  results: OstaCompetitionResult[]
}

export interface OstaParsedResults {
  pid: string
  resolvedName: string
  competitions: OstaParsedCompetition[]
}

export class OstaMultipleMatchesError extends Error {
  constructor(
    public queryName: string,
    public candidates: OstaCandidate[],
  ) {
    super(`Meerdere OSTA profielen gevonden voor '${queryName}'.`)
  }
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(path, OSTA_BASE)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function fetchSoup(path: string, params?: Record<string, string | number | undefined>) {
  const url = buildUrl(path, params)
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  } catch {
    throw new Error('Kon OSTA niet bereiken.')
  }
  if (!res.ok) throw new Error(`OSTA fout: HTTP ${res.status}.`)
  const html = await res.text()
  return cheerio.load(html)
}

export function defaultOstaSearchName(skaterName: string): string {
  return skaterName.trim()
}

export function normalizeOstaVenue(rawValue: string | null): string | null {
  const OSTA_VENUE_MAP: Record<string, string> = {
    AK: 'Alkmaar (NED)',
    AM: 'Amsterdam (NED)',
    AS: 'Assen (NED)',
    BR: 'Breda (NED)',
    DN: 'Dronten (NED)',
    DV: 'Deventer (NED)',
    DT: 'Deventer (NED)',
    EN: 'Enschede (NED)',
    EV: 'Eindhoven (NED)',
    GR: 'Groningen (NED)',
    HA: 'Haarlem (NED)',
    HV: 'Heerenveen (NED)',
    HR: 'Herentals (BEL)',
    LE: 'Leeuwarden (NED)',
    NI: 'Nijmegen (NED)',
    TB: 'Tilburg (NED)',
    UT: 'Utrecht (NED)',
  }
  const code = (rawValue ?? '').trim().toUpperCase()
  if (!code) return null
  return OSTA_VENUE_MAP[code] ?? code
}

export async function ostaLookupCandidates(searchName: string): Promise<OstaCandidate[]> {
  const queryName = defaultOstaSearchName(searchName)
  if (!queryName) throw new Error('Voer een naam in voor OSTA.')

  const $ = await fetchSoup('index.php', { ZoekStr: queryName })
  const candidates: OstaCandidate[] = []
  const seenPids = new Set<string>()

  $('table.naam tr').each((_, el) => {
    const cells = $(el).find('td')
    if (cells.length < 1) return
    const link = $(cells[0]).find('a[href]').first()
    if (!link.length) return

    const href = link.attr('href') ?? ''
    const parsed = new URL(href, OSTA_BASE)
    const pid = (parsed.searchParams.get('pid') ?? '').trim()
    if (!pid || seenPids.has(pid)) return
    seenPids.add(pid)

    candidates.push({
      pid,
      name: link.text().trim().replace(/\s+/g, ' '),
      category: cells.eq(1).text().trim().replace(/\s+/g, ' '),
      seasons: cells.eq(2).text().trim().replace(/\s+/g, ' '),
      club: cells.eq(3).text().trim().replace(/\s+/g, ' '),
    })
  })

  if (candidates.length) return candidates

  const pidInput = $("form#tijden input[name='pid']")
  const heading = $('div#main h1').first()
  const pidValue = (pidInput.attr('value') ?? '').trim()
  if (!pidValue) return []

  return [
    {
      pid: pidValue,
      name: heading.text().trim().replace(/\s+/g, ' ') || queryName,
      category: '',
      seasons: '',
      club: '',
    },
  ]
}

export async function ostaLookupPid(searchName: string): Promise<{ pid: string; name: string }> {
  const queryName = defaultOstaSearchName(searchName)
  const candidates = await ostaLookupCandidates(queryName)
  if (!candidates.length) throw new Error(`Geen OSTA resultaat gevonden voor '${queryName}'.`)
  if (candidates.length > 1) throw new OstaMultipleMatchesError(queryName, candidates)
  return { pid: candidates[0]!.pid, name: candidates[0]!.name || queryName }
}

function ostaBuildLapsCsv($detail: cheerio.CheerioAPI): string | null {
  const rows = $detail('table.rit tr')
  if (!rows.length) return null

  const lapValues: number[] = []
  rows.each((idx, el) => {
    if (idx === 0) return // header row
    const cells = $detail(el).find('td')
    if (cells.length < 3) return
    const cumulativeText = cells.eq(1).text().trim()
    const lapText = cells.eq(2).text().trim()
    const source = lapText || cumulativeText
    if (!source) return
    try {
      lapValues.push(parseTimeToMs(source) / 1000)
    } catch {
      // skip unparsable row
    }
  })

  if (!lapValues.length) return null
  return lapValues.map((v) => v.toFixed(2)).join(',')
}

function ostaExtractCompetitionName($detail: cheerio.CheerioAPI, fallbackName: string): string {
  const info = $detail('p.wedinfo').first()
  if (!info.length) return fallbackName
  const text = info.text().trim().replace(/\s+/g, ' ')
  const match = text.match(/^\d{4}-\d{2}-\d{2}\s+\d+\s+(.+)$/)
  return match ? match[1]!.trim() : fallbackName
}

/** date must already be normalized to YYYY-MM-DD by the caller (parseDateAny). */
function parseOstaDate(text: string): string {
  // OSTA dates render as YYYY-MM-DD already in the fixtures/live site.
  const trimmed = text.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`Onbekend datumformaat: ${text}`)
  }
  return trimmed
}

export async function extractOstaResultsForPid(
  searchName: string,
  season: string,
  pid: string,
): Promise<OstaParsedResults> {
  const pidValue = pid.trim()
  const resolvedName = defaultOstaSearchName(searchName)
  if (!pidValue) throw new Error('OSTA PID ontbreekt.')

  const $ = await fetchSoup('index.php', { pid: pidValue, Seizoen: season, perAfstand: 0 })

  const competitionGroups = new Map<string, OstaParsedCompetition>()
  const seenRaces = new Set<string>()

  const rows = $('table.datum tr').toArray()
  for (const el of rows) {
    const cells = $(el).find('td')
    if (cells.length < 6) continue

    const dateText = cells.eq(0).text().trim()
    const venueCode = cells.eq(1).text().trim() || null
    const distanceText = cells.eq(2).text().trim()
    const timeLink = cells.eq(3).find('a').first()
    const competitionLink = cells.eq(5).find('a').first()
    if (!timeLink.length || !competitionLink.length) continue

    let compDate: string
    let distanceM: number
    let totalTimeMs: number
    try {
      compDate = parseOstaDate(dateText)
      distanceM = Number.parseInt(distanceText, 10)
      if (!Number.isFinite(distanceM)) continue
      totalTimeMs = parseTimeToMs(timeLink.text().trim())
    } catch {
      continue
    }

    const competitionName = competitionLink.text().trim().replace(/\s+/g, ' ')
    const detailHref = timeLink.attr('href') ?? ''
    const $detail = await fetchSoup(detailHref)
    const lapsCsv = ostaBuildLapsCsv($detail)
    const detailCompetitionName = ostaExtractCompetitionName($detail, competitionName)

    const competitionKey = `${compDate}|${detailCompetitionName.toLowerCase()}`
    const raceKey = `${competitionKey}|${distanceM}|${totalTimeMs}`
    if (seenRaces.has(raceKey)) continue
    seenRaces.add(raceKey)

    let competition = competitionGroups.get(competitionKey)
    if (!competition) {
      competition = {
        name: detailCompetitionName,
        venue: normalizeOstaVenue(venueCode),
        date: compDate,
        sourcePid: pidValue,
        results: [],
      }
      competitionGroups.set(competitionKey, competition)
    }

    competition.results.push({
      distanceM,
      totalTimeMs,
      lapsCsv,
      sourceRef: buildUrl(detailHref),
    })
  }

  const competitions = [...competitionGroups.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, c]) => c)

  if (!competitions.length) {
    throw new Error('Geen OSTA ritten gevonden voor deze naam en dit seizoen.')
  }

  return { pid: pidValue, resolvedName, competitions }
}

export function mergeOstaResults(searchName: string, parsedResults: OstaParsedResults[]): OstaParsedResults {
  const grouped = new Map<string, OstaParsedCompetition & { seenRaces: Set<string> }>()
  const pidValues: string[] = []

  for (const parsed of parsedResults) {
    if (parsed.pid && !pidValues.includes(parsed.pid)) pidValues.push(parsed.pid)
    for (const competition of parsed.competitions) {
      const key = `${competition.date}|${competition.name.toLowerCase()}|${competition.sourcePid}`
      let target = grouped.get(key)
      if (!target) {
        target = { ...competition, results: [], seenRaces: new Set() }
        grouped.set(key, target)
      }
      for (const result of competition.results) {
        const raceKey = `${result.distanceM}|${result.totalTimeMs}`
        if (target.seenRaces.has(raceKey)) continue
        target.seenRaces.add(raceKey)
        target.results.push(result)
      }
    }
  }

  const competitions = [...grouped.values()].filter((c) => c.results.length)
  if (!competitions.length) {
    throw new Error('Geen OSTA ritten gevonden voor deze naam en dit seizoen.')
  }

  return {
    pid: pidValues.length === 1 ? pidValues[0]! : '',
    resolvedName: defaultOstaSearchName(searchName),
    competitions: competitions.map(({ seenRaces: _seenRaces, ...c }) => c),
  }
}

export async function extractOstaResultsForMonitor(
  searchName: string,
  season: string,
  pid = '',
): Promise<OstaParsedResults> {
  if (pid.trim()) return extractOstaResultsForPid(searchName, season, pid.trim())

  const candidates = await ostaLookupCandidates(searchName)
  if (!candidates.length) {
    throw new Error(`Geen OSTA resultaat gevonden voor '${defaultOstaSearchName(searchName)}'.`)
  }

  const parsedResults = await Promise.all(
    candidates.filter((c) => c.pid).map((c) => extractOstaResultsForPid(searchName, season, c.pid)),
  )
  return mergeOstaResults(searchName, parsedResults)
}
