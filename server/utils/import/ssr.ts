import { XMLParser } from 'fast-xml-parser'
import { parseTimeToMs } from '../time'

/**
 * SpeedSkatingResults (speedskatingresults.com) integration, ported from
 * app/main.py (old app, commit 4dc6959): ssr_lookup_skater_id,
 * ssr_api_get, extract_ssr_results_for_skater, parse_ssr_time_value,
 * ssr_competition_key. Base URLs/endpoints/params are the portable part
 * (REBUILD_PLAN.md section 4). Tested against
 * reference/fixtures/ssr/*.
 *
 * NOTE (also true of the old app): SSR results never carry lap times --
 * every parsed race here has lapsMs: null. Only totals are available.
 */

export const SSR_API_BASE = 'https://speedskatingresults.com/api/json'
export const SSR_XML_API_BASE = 'https://speedskatingresults.com/api/xml'
export const SSR_DISTANCES = [100, 300, 500, 1000, 1500, 3000, 5000, 10000] as const

export interface SsrSkaterCandidate {
  id: string
  givenname: string
  familyname: string
  suffix: string
  country: string
  gender: string
  category: string
}

export interface SsrRaceResult {
  distanceM: number
  totalTimeMs: number | null
  status: string
  sourceRef: string | null
}

export interface SsrParsedCompetition {
  name: string
  venue: string | null
  date: string
  sourceRef: string | null
  results: SsrRaceResult[]
}

export interface SsrParsedResults {
  competitions: SsrParsedCompetition[]
}

/** Ported from parse_ssr_time_value. Returns [totalTimeMs, status]. */
export function parseSsrTimeValue(rawTime: string | null | undefined): [number | null, string] {
  const value = (rawTime ?? '').trim()
  if (!value) return [null, 'finished']

  const upper = value.toUpperCase()
  const STATUS_TOKENS: Record<string, string> = { DNF: 'dnf', DNS: 'dns', DSQ: 'dsq', DQ: 'dq', WDR: 'wdr', NC: 'nc' }
  if (upper in STATUS_TOKENS) return [null, STATUS_TOKENS[upper]!]

  let normalized = value.replace(/,/g, '.')
  const dotCount = (normalized.match(/\./g) ?? []).length
  if (dotCount >= 2 && !normalized.includes(':')) {
    const firstDot = normalized.indexOf('.')
    normalized = `${normalized.slice(0, firstDot)}:${normalized.slice(firstDot + 1)}`
  }

  try {
    return [parseTimeToMs(normalized), 'finished']
  } catch {
    return [null, 'finished']
  }
}

async function ssrApiGet(path: string, params: Record<string, string | number>): Promise<unknown> {
  const url = new URL(`${SSR_API_BASE}/${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== undefined) url.searchParams.set(key, String(value))
  }

  let res: Response
  try {
    res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) })
  } catch {
    throw new Error('Kon SpeedSkatingResults niet bereiken.')
  }
  if (!res.ok) throw new Error(`SpeedSkatingResults API fout: HTTP ${res.status}.`)
  try {
    return await res.json()
  } catch {
    throw new Error('Kon antwoord van SpeedSkatingResults niet lezen.')
  }
}

export async function ssrLookupSkaterId(givenName: string, familyName: string): Promise<SsrSkaterCandidate> {
  const given = givenName.trim()
  const family = familyName.trim()
  if (!given || !family) throw new Error('Vul zowel voornaam als achternaam in voor een SSR lookup.')

  const url = new URL(`${SSR_XML_API_BASE}/skater_lookup.php`)
  url.searchParams.set('givenname', given)
  url.searchParams.set('familyname', family)

  let res: Response
  try {
    res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) })
  } catch {
    throw new Error('Kon SpeedSkatingResults lookup niet bereiken.')
  }
  if (!res.ok) throw new Error(`SpeedSkatingResults lookup fout: HTTP ${res.status}.`)

  const xmlText = await res.text()
  let parsed: unknown
  try {
    parsed = new XMLParser().parse(xmlText)
  } catch {
    throw new Error('Kon XML-antwoord van SpeedSkatingResults niet lezen.')
  }

  const root = parsed as Record<string, unknown>
  const skatersRoot = (root.skaters ?? root) as Record<string, unknown>
  const rawSkaters = skatersRoot?.skater
  const skaterList = Array.isArray(rawSkaters) ? rawSkaters : rawSkaters ? [rawSkaters] : []

  const candidates: SsrSkaterCandidate[] = skaterList
    .map((s: Record<string, unknown>) => ({
      id: String(s.id ?? '').trim(),
      givenname: String(s.givenname ?? '').trim(),
      familyname: String(s.familyname ?? '').trim(),
      suffix: String(s.suffix ?? '').trim(),
      country: String(s.country ?? '').trim(),
      gender: String(s.gender ?? '').trim(),
      category: String(s.category ?? '').trim(),
    }))
    .filter((s) => s.id)

  if (!candidates.length) throw new Error('Geen SSR schaatser gevonden met deze naam.')
  if (candidates.length > 1) {
    // SSR disambiguates same-name skaters with a birth-year `suffix` (e.g.
    // multiple "Erik Jansen" entries) -- surface it so the error message is
    // actually useful for picking the right one, instead of listing
    // otherwise-identical-looking candidates.
    const labels = candidates
      .slice(0, 5)
      .map((c) => `${c.givenname} ${c.familyname}${c.suffix ? ` (${c.suffix})` : ''} (${c.country || '-'}, id ${c.id})`)
      .join(', ')
    throw new Error(`Meerdere SSR schaatsers gevonden: ${labels}`)
  }

  return candidates[0]!
}

function ssrCompetitionKey(item: Record<string, unknown>): string {
  const date = String(item.date ?? '').trim()
  const link = String(item.link ?? '').trim()
  let eventId = ''
  if (link) {
    try {
      eventId = new URL(link).searchParams.get('e') ?? ''
    } catch {
      eventId = ''
    }
  }
  if (eventId) return `${date}|e:${eventId}`
  return `${date}|${String(item.name ?? '').trim()}|${String(item.location ?? '').trim()}`
}

/** date must already be a valid YYYY-MM-DD or DD-MM-YYYY-shaped string from the API. */
function parseSsrDate(raw: string): string {
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const dmy = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`
  throw new Error(`Onbekend datumformaat: ${raw}`)
}

export async function extractSsrResultsForSkater(skaterId: string, season: string): Promise<SsrParsedResults> {
  const seasonValue = season.trim()
  if (!/^\d{4}$/.test(seasonValue)) throw new Error('Seizoen moet een startjaar zijn, bijvoorbeeld 2025.')
  const skaterValue = skaterId.trim()
  if (!/^\d+$/.test(skaterValue)) throw new Error('Gebruik een numerieke SpeedSkatingResults skater-id.')

  const grouped = new Map<string, SsrParsedCompetition>()
  const seenRaces = new Set<string>()

  for (const distance of SSR_DISTANCES) {
    const payload = await ssrApiGet('skater_results.php', { skater: skaterValue, season: seasonValue, distance })
    const items: Record<string, unknown>[] = Array.isArray(payload)
      ? (payload as Record<string, unknown>[])
      : Array.isArray((payload as Record<string, unknown>)?.results)
        ? ((payload as Record<string, unknown>).results as Record<string, unknown>[])
        : Array.isArray((payload as Record<string, unknown>)?.data)
          ? ((payload as Record<string, unknown>).data as Record<string, unknown>[])
          : []

    for (const item of items) {
      const dateRaw = String(item.date ?? '').trim()
      if (!dateRaw) continue
      let compDate: string
      try {
        compDate = parseSsrDate(dateRaw)
      } catch {
        continue
      }

      const compKey = ssrCompetitionKey(item)
      let competition = grouped.get(compKey)
      if (!competition) {
        competition = {
          name: String(item.name ?? 'SpeedSkatingResults import').trim() || 'SpeedSkatingResults import',
          venue: String(item.location ?? '').trim() || null,
          date: compDate,
          sourceRef: String(item.link ?? '').trim() || null,
          results: [],
        }
        grouped.set(compKey, competition)
      }

      const itemDistance = Number.parseInt(String(item.distance ?? distance), 10)
      const distanceValue = Number.isFinite(itemDistance) ? itemDistance : distance
      const [totalTimeMs, status] = parseSsrTimeValue(item.time as string | undefined)

      const raceKey = `${compKey}|${distanceValue}|${totalTimeMs}|${status}`
      if (seenRaces.has(raceKey)) continue
      seenRaces.add(raceKey)

      competition.results.push({
        distanceM: distanceValue,
        totalTimeMs,
        status,
        sourceRef: String(item.link ?? '').trim() || null,
      })
    }
  }

  const competitions = [...grouped.values()].filter((c) => c.results.length)
  if (!competitions.length) {
    throw new Error('Geen SpeedSkatingResults-uitslagen gevonden voor deze schaatser en dit seizoen.')
  }

  return { competitions }
}
