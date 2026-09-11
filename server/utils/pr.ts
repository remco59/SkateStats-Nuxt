import { seasonLabelForDate } from './season'

/**
 * PR/SB sequencing, ported from app/main.py (old app, commit 4dc6959):
 * collect_pr_race_ids, build_pr_progress. Behavior pinned by
 * reference/fixtures/calculations/golden_calculations.json.
 *
 * DELIBERATE BEHAVIOR CHANGE from the old app (REBUILD_PLAN.md section
 * 5.4 / `known_bug_same_day_ordering`): the old app tie-breaks same-day
 * races by raw DB insertion order (id ASC), which can misattribute which
 * race "set" the PR if races for one day aren't entered in the order they
 * actually happened. This port tie-breaks by the explicit
 * `sequenceInDay` field instead (schema: races.sequenceInDay) so ordering
 * is deliberate, not accidental. A race whose `sequenceInDay` isn't set
 * defaults to 0, so behavior degrades to "id order among untouched rows"
 * only when nobody has ever needed to reorder same-day races.
 */

export interface RaceForPr {
  id: number
  distanceM: number | null
  totalTimeMs: number | null
  status: string // 'finished' means it has a real time; anything else excluded
  competitionDate: string | null
  sequenceInDay: number
}

export interface PrProgressEntry {
  isPr: boolean
  previousPrMs: number | null
  deltaVsPreviousPrMs: number | null
  deltaAbsMs: number | null
}

function sortForPr<T extends RaceForPr>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const dateA = a.competitionDate ?? ''
    const dateB = b.competitionDate ?? ''
    if (dateA !== dateB) return dateA < dateB ? -1 : 1
    if (a.sequenceInDay !== b.sequenceInDay) return a.sequenceInDay - b.sequenceInDay
    return a.id - b.id
  })
}

function isEligible(row: RaceForPr): boolean {
  return row.distanceM !== null && row.totalTimeMs !== null && row.status === 'finished'
}

export function collectPrRaceIds(rows: RaceForPr[]): Set<number> {
  const bestByDistance = new Map<number, number>()
  const prIds = new Set<number>()

  for (const row of sortForPr(rows)) {
    if (!isEligible(row)) continue
    const distance = row.distanceM as number
    const totalTimeMs = row.totalTimeMs as number
    const currentBest = bestByDistance.get(distance)
    if (currentBest === undefined || totalTimeMs < currentBest) {
      bestByDistance.set(distance, totalTimeMs)
      prIds.add(row.id)
    }
  }

  return prIds
}

export function buildPrProgress(rows: RaceForPr[]): Map<number, PrProgressEntry> {
  const progress = new Map<number, PrProgressEntry>()
  const bestByDistance = new Map<number, number>()

  for (const row of sortForPr(rows)) {
    const entry: PrProgressEntry = {
      isPr: false,
      previousPrMs: null,
      deltaVsPreviousPrMs: null,
      deltaAbsMs: null,
    }
    progress.set(row.id, entry)

    if (!isEligible(row)) continue

    const distance = row.distanceM as number
    const totalTimeMs = row.totalTimeMs as number
    const previousBest = bestByDistance.get(distance) ?? null
    entry.previousPrMs = previousBest

    if (previousBest === null || totalTimeMs < previousBest) {
      entry.isPr = true
      if (previousBest !== null) {
        entry.deltaVsPreviousPrMs = totalTimeMs - previousBest
        entry.deltaAbsMs = Math.abs(totalTimeMs - previousBest)
      }
      bestByDistance.set(distance, totalTimeMs)
    } else {
      entry.deltaVsPreviousPrMs = totalTimeMs - previousBest
      entry.deltaAbsMs = Math.abs(totalTimeMs - previousBest)
    }
  }

  return progress
}

/** Season-best race ids: same PR rule, scoped per season label (section 5.4). */
export function collectSbRaceIds(rows: RaceForPr[]): Set<number> {
  const bestBySeasonDistance = new Map<string, number>()
  const sbIds = new Set<number>()

  for (const row of sortForPr(rows)) {
    if (!isEligible(row) || !row.competitionDate) continue
    const season = seasonLabelForDate(row.competitionDate)
    const distance = row.distanceM as number
    const totalTimeMs = row.totalTimeMs as number
    const key = `${season}|${distance}`
    const currentBest = bestBySeasonDistance.get(key)
    if (currentBest === undefined || totalTimeMs < currentBest) {
      bestBySeasonDistance.set(key, totalTimeMs)
      sbIds.add(row.id)
    }
  }

  return sbIds
}

/**
 * Walking races newest-first, count consecutive races that are each
 * either a PR or an SB; stop at the first race that's neither.
 */
export function computeStreak(rows: RaceForPr[]): { count: number; items: RaceForPr[] } {
  const sorted = sortForPr(rows)
  const prIds = collectPrRaceIds(rows)
  const sbIds = collectSbRaceIds(rows)

  const items: RaceForPr[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const row = sorted[i]
    if (!row) continue
    const isHit = prIds.has(row.id) || sbIds.has(row.id)
    if (!isHit) break
    items.push(row)
  }

  return { count: items.length, items }
}

/** "Recent" for notification purposes: within the last 30 days of `now`. */
export function isRecent(dateStr: string, now: Date = new Date()): boolean {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return dateStr >= cutoffStr
}
