/**
 * The races list's filtering, ordering and filter options. Ported from the
 * old app's build_races_context (SQL) and pinned by
 * reference/fixtures/calculations/golden_lists.json, which was produced by
 * running that function's real queries on an in-memory database.
 */

import { RACE_TAGS } from '../../shared/constants'

export interface RaceListRow {
  id: number
  distanceM: number
  totalTimeMs: number | null
  tag: string | null
  lane: string | null
  venue: string | null
  competitionName: string
  competitionDate: string
}

export interface RaceListFilters {
  /** Substring of competition name or venue (this app's own addition; the old page had none). */
  q?: string
  distanceM?: number | null
  tag?: string
  lane?: string
  venue?: string
  /** Inclusive, "YYYY-MM-DD". */
  dateFrom?: string
  dateTo?: string
}

const lower = (value: string | null | undefined) => (value ?? '').toLowerCase()

/**
 * Newest first; within a date by distance, then fastest first; then the
 * later-added race first. A race without a time (DNS, DNF, ...) goes after
 * the timed ones of the same distance.
 */
export function compareRacesForList(a: RaceListRow, b: RaceListRow): number {
  if (a.competitionDate !== b.competitionDate) return a.competitionDate < b.competitionDate ? 1 : -1
  if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM
  if (a.totalTimeMs !== b.totalTimeMs) {
    if (a.totalTimeMs === null) return 1
    if (b.totalTimeMs === null) return -1
    return a.totalTimeMs - b.totalTimeMs
  }
  return b.id - a.id
}

export function filterAndSortRaces<T extends RaceListRow>(rows: T[], filters: RaceListFilters): T[] {
  const q = lower(filters.q).trim()
  const lane = lower(filters.lane).trim()
  const venue = lower(filters.venue).trim()
  // An unknown tag is not a filter at all (the old app normalised it away
  // and listed everything), rather than a filter that matches nothing.
  const tag = (RACE_TAGS as readonly string[]).includes(filters.tag ?? '') ? filters.tag! : ''
  const dateFrom = (filters.dateFrom ?? '').trim()
  const dateTo = (filters.dateTo ?? '').trim()

  return rows
    .filter((r) => {
      if (filters.distanceM && r.distanceM !== filters.distanceM) return false
      if (tag && r.tag !== tag) return false
      // Lane and venue: exact, case-insensitive (not substring).
      if (lane && lower(r.lane) !== lane) return false
      if (venue && lower(r.venue) !== venue) return false
      if (dateFrom && r.competitionDate < dateFrom) return false
      if (dateTo && r.competitionDate > dateTo) return false
      if (q && !lower(r.competitionName).includes(q) && !lower(r.venue).includes(q)) return false
      return true
    })
    .sort(compareRacesForList)
}

/** Distinct non-blank values, sorted; case variants ("Binnen"/"binnen") collapsed to the first. */
export function distinctOptions(values: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>()
  for (const raw of [...values].sort()) {
    if (raw === null || raw === undefined || raw.trim() === '') continue
    if (!seen.has(raw.toLowerCase())) seen.set(raw.toLowerCase(), raw)
  }
  return [...seen.values()]
}

export function buildRaceFilterOptions(rows: RaceListRow[]) {
  return {
    distanceOptions: [...new Set(rows.map((r) => r.distanceM))].sort((a, b) => a - b),
    venueOptions: distinctOptions(rows.map((r) => r.venue)),
    laneOptions: distinctOptions(rows.map((r) => r.lane)),
  }
}
