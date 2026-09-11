import { seasonBoundsFromLabel, seasonLabelForDate } from './season'
import { pythonRound } from '../../shared/utils/round'
import { collectPrRaceIds, collectSbRaceIds, type RaceForPr } from './pr'

/**
 * Stats engine ported (scoped) from app/main.py::build_stats_context (old
 * app, commit 4dc6959). Covers the four analytical sections + per-distance
 * PR history REBUILD_PLAN.md section 3 calls for (base, consistency,
 * track/venue, progression); the old app's extra narrative flourishes
 * (auto-generated "story" paragraphs, fastest-lap/opener callouts, month
 * counts) are presentational sugar on top of the same numbers and are not
 * ported -- the numbers themselves are.
 */

export interface StatsRaceInput {
  id: number
  competitionId: number
  distanceM: number
  totalTimeMs: number | null
  status: string
  competitionDate: string
  venue: string | null
  lapsMs: number[]
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function pstdev(values: number[]): number {
  const m = mean(values)
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)))
}

export function collectSeasonLabels(rows: StatsRaceInput[]): string[] {
  const labels = new Set(rows.map((r) => seasonLabelForDate(r.competitionDate)))
  return [...labels].sort()
}

export interface DistanceStatsRow {
  distanceM: number
  pbMs: number
  pbRaceId: number
  seasonBestMs: number | null
  seasonBestRaceId: number | null
  averageMs: number
  medianMs: number
  stdDevMs: number
  rangeMs: number
  firstMs: number
  firstRaceId: number
  latestMs: number
  latestRaceId: number
  improvementMs: number
  last5AvgMs: number | null
  seasonAvgMs: number | null
  trend: 'verbeterend' | 'verslechterend' | 'stabiel' | 'n.v.t.'
}

export interface TrackStatsRow {
  venue: string
  raceCount: number
  avg500EqMs: number
  best500EqMs: number
}

export interface StatsContext {
  seasonOptions: string[]
  selectedSeason: string
  distanceOptions: number[]
  selectedDistanceM: number | null
  basic: { competitionCount: number; raceCount: number; totalKm: number; pbCount: number; sbCount: number }
  distanceRows: DistanceStatsRow[]
  trackRows: TrackStatsRow[]
  bestTrack: { name: string; deltaMs: number } | null
  worstTrack: { name: string; deltaMs: number } | null
}

export function buildStatsContext(
  allRows: StatsRaceInput[],
  opts: { season?: string; distanceM?: number | null } = {},
): StatsContext {
  const seasonOptions = collectSeasonLabels(allRows)
  const currentSeason = seasonLabelForDate(new Date().toISOString().slice(0, 10))
  let selectedSeason = (opts.season ?? '').trim()
  if (selectedSeason && !seasonOptions.includes(selectedSeason)) selectedSeason = ''

  let filtered = allRows
  if (selectedSeason) {
    const [start, end] = seasonBoundsFromLabel(selectedSeason)
    filtered = filtered.filter((r) => r.competitionDate >= start && r.competitionDate <= end)
  }
  const distanceOptions = [...new Set(allRows.map((r) => r.distanceM))].sort((a, b) => a - b)
  const selectedDistanceM = opts.distanceM ?? null
  if (selectedDistanceM) filtered = filtered.filter((r) => r.distanceM === selectedDistanceM)

  const timedRows = filtered.filter((r) => r.totalTimeMs !== null && r.status === 'finished')
  const sortedTimed = [...timedRows].sort((a, b) =>
    a.competitionDate !== b.competitionDate ? (a.competitionDate < b.competitionDate ? -1 : 1) : a.id - b.id,
  )

  const forPr: RaceForPr[] = filtered.map((r) => ({
    id: r.id,
    distanceM: r.distanceM,
    totalTimeMs: r.totalTimeMs,
    status: r.status,
    competitionDate: r.competitionDate,
    sequenceInDay: 0,
  }))
  const pbRaceIds = collectPrRaceIds(forPr)
  const sbRaceIds = collectSbRaceIds(forPr)

  const totalKm = filtered.reduce((sum, r) => sum + r.distanceM, 0) / 1000

  const byDistance = new Map<number, StatsRaceInput[]>()
  for (const row of sortedTimed) {
    const list = byDistance.get(row.distanceM) ?? []
    list.push(row)
    byDistance.set(row.distanceM, list)
  }

  const sbReferenceSeason = selectedSeason || currentSeason
  const distanceRows: DistanceStatsRow[] = []

  for (const distance of [...byDistance.keys()].sort((a, b) => a - b)) {
    const rowsForDistance = byDistance.get(distance)!
    const times = rowsForDistance.map((r) => r.totalTimeMs!)
    const pbRow = [...rowsForDistance].sort((a, b) => (a.totalTimeMs! !== b.totalTimeMs! ? a.totalTimeMs! - b.totalTimeMs! : a.id - b.id))[0]!
    const seasonSubset = rowsForDistance.filter((r) => seasonLabelForDate(r.competitionDate) === sbReferenceSeason)
    const seasonBestRow = seasonSubset.length
      ? [...seasonSubset].sort((a, b) => (a.totalTimeMs! !== b.totalTimeMs! ? a.totalTimeMs! - b.totalTimeMs! : a.id - b.id))[0]!
      : null

    const firstRow = rowsForDistance[0]!
    const latestRow = rowsForDistance[rowsForDistance.length - 1]!
    const last5 = rowsForDistance.slice(-5)
    const last5AvgMs = last5.length ? pythonRound(mean(last5.map((r) => r.totalTimeMs!))) : null
    const seasonAvgMs = seasonSubset.length ? pythonRound(mean(seasonSubset.map((r) => r.totalTimeMs!))) : null

    let trend: DistanceStatsRow['trend'] = 'n.v.t.'
    if (last5AvgMs !== null && seasonAvgMs !== null) {
      if (last5AvgMs <= seasonAvgMs - 200) trend = 'verbeterend'
      else if (last5AvgMs >= seasonAvgMs + 200) trend = 'verslechterend'
      else trend = 'stabiel'
    }

    distanceRows.push({
      distanceM: distance,
      pbMs: pbRow.totalTimeMs!,
      pbRaceId: pbRow.id,
      seasonBestMs: seasonBestRow?.totalTimeMs ?? null,
      seasonBestRaceId: seasonBestRow?.id ?? null,
      averageMs: pythonRound(mean(times)),
      medianMs: pythonRound(median(times)),
      stdDevMs: times.length >= 2 ? pythonRound(pstdev(times)) : 0,
      rangeMs: Math.max(...times) - Math.min(...times),
      firstMs: firstRow.totalTimeMs!,
      firstRaceId: firstRow.id,
      latestMs: latestRow.totalTimeMs!,
      latestRaceId: latestRow.id,
      improvementMs: latestRow.totalTimeMs! - firstRow.totalTimeMs!,
      last5AvgMs,
      seasonAvgMs,
      trend,
    })
  }

  const trackGrouped = new Map<string, StatsRaceInput[]>()
  for (const row of sortedTimed) {
    const venue = (row.venue ?? '').trim()
    if (!venue) continue
    const list = trackGrouped.get(venue) ?? []
    list.push(row)
    trackGrouped.set(venue, list)
  }

  const trackRows: TrackStatsRow[] = []
  const all500Eq: number[] = []
  for (const [venue, venueRows] of trackGrouped) {
    const per500Eq = venueRows
      .filter((r) => r.distanceM > 0)
      .map((r) => pythonRound((r.totalTimeMs! * 500) / r.distanceM))
    if (!per500Eq.length) continue
    all500Eq.push(...per500Eq)
    trackRows.push({
      venue,
      raceCount: venueRows.length,
      avg500EqMs: pythonRound(mean(per500Eq)),
      best500EqMs: Math.min(...per500Eq),
    })
  }
  trackRows.sort((a, b) => a.avg500EqMs - b.avg500EqMs || a.venue.localeCompare(b.venue))

  let bestTrack: StatsContext['bestTrack'] = null
  let worstTrack: StatsContext['worstTrack'] = null
  if (all500Eq.length && trackRows.length) {
    const overall = pythonRound(mean(all500Eq))
    const best = trackRows.reduce((a, b) => (a.avg500EqMs <= b.avg500EqMs ? a : b))
    const worst = trackRows.reduce((a, b) => (a.avg500EqMs >= b.avg500EqMs ? a : b))
    bestTrack = { name: best.venue, deltaMs: best.avg500EqMs - overall }
    worstTrack = { name: worst.venue, deltaMs: worst.avg500EqMs - overall }
  }

  return {
    seasonOptions,
    selectedSeason,
    distanceOptions,
    selectedDistanceM,
    basic: {
      competitionCount: new Set(filtered.map((r) => r.competitionId)).size,
      raceCount: filtered.length,
      totalKm,
      pbCount: pbRaceIds.size,
      sbCount: sbRaceIds.size,
    },
    distanceRows,
    trackRows,
    bestTrack,
    worstTrack,
  }
}
