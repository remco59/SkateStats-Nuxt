import { pythonRound } from '../../shared/utils/round'
import { computeRaceMetrics } from './splits'

/**
 * "Voortgang" for a target: how the skater's actual results compare with
 * each part of the target. Ported from the old app's build_distance_stats
 * (the lap-derived fields) and build_goal_progress, and pinned by
 * reference/fixtures/calculations/golden_targets.json -> target_progress.
 */

export interface TargetStatsRace {
  distanceM: number
  totalTimeMs: number | null
  status: string
  lapsMs: number[]
}

export interface DistanceTargetStats {
  bestTimeMs: number
  /** Fastest opening split over all races with laps, in seconds. */
  bestOpeningS: number | null
  /** The best race's average 400 m lap (lowest of the per-race averages), in seconds. */
  avgLapS: number | null
  /** Fastest final 400 m-equivalent, in seconds. */
  bestLast400S: number | null
  /** Mean of (last - first) 400 m-equivalent over races with laps, in seconds. */
  avgFadeS: number | null
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

function minOrNull(values: number[]): number | null {
  return values.length ? Math.min(...values) : null
}

export function buildDistanceTargetStats(races: TargetStatsRace[]): Map<number, DistanceTargetStats> {
  const grouped = new Map<number, TargetStatsRace[]>()
  for (const race of races) {
    if (race.totalTimeMs === null || race.status !== 'finished') continue
    const list = grouped.get(race.distanceM) ?? []
    list.push(race)
    grouped.set(race.distanceM, list)
  }

  const stats = new Map<number, DistanceTargetStats>()
  for (const [distanceM, rows] of grouped) {
    const openings: number[] = []
    const avg400: number[] = []
    const last400: number[] = []
    const fades: number[] = []

    for (const row of rows) {
      const laps = row.lapsMs.map((ms) => ms / 1000)
      if (!laps.length) continue
      const metrics = computeRaceMetrics(laps, distanceM)
      openings.push(laps[0]!)
      if (metrics.avg400 !== null) avg400.push(metrics.avg400)
      if (metrics.last400Eq !== null) last400.push(metrics.last400Eq)
      if (metrics.fade400Eq !== null) fades.push(metrics.fade400Eq)
    }

    stats.set(distanceM, {
      bestTimeMs: Math.min(...rows.map((r) => r.totalTimeMs as number)),
      bestOpeningS: minOrNull(openings),
      avgLapS: minOrNull(avg400),
      bestLast400S: minOrNull(last400),
      avgFadeS: mean(fades),
    })
  }
  return stats
}

export type TargetProgressKey = 'time' | 'opening' | 'avgLap' | 'lastLap' | 'fade'

export interface TargetProgressRow {
  key: TargetProgressKey
  label: string
  targetMs: number
  actualMs: number | null
  deltaMs: number | null
  metGoal: boolean
}

export interface TargetValues {
  targetTimeMs: number | null
  openingMs: number | null
  avg400Ms: number | null
  last400Ms: number | null
  fade400Ms: number | null
}

const secondsToMs = (s: number | null | undefined) => (s === null || s === undefined ? null : pythonRound(s * 1000))

/** One row per part of the target that is actually set; empty when nothing is. */
export function buildTargetProgress(target: TargetValues, stats: DistanceTargetStats | null): TargetProgressRow[] {
  const comparisons: { key: TargetProgressKey; label: string; targetMs: number | null; actualMs: number | null }[] = [
    { key: 'time', label: 'Doeltijd', targetMs: target.targetTimeMs, actualMs: stats?.bestTimeMs ?? null },
    { key: 'opening', label: 'Opening', targetMs: target.openingMs, actualMs: secondsToMs(stats?.bestOpeningS) },
    { key: 'avgLap', label: 'Gem. ronde', targetMs: target.avg400Ms, actualMs: secondsToMs(stats?.avgLapS) },
    { key: 'lastLap', label: 'Laatste ronde', targetMs: target.last400Ms, actualMs: secondsToMs(stats?.bestLast400S) },
    { key: 'fade', label: 'Verval', targetMs: target.fade400Ms, actualMs: secondsToMs(stats?.avgFadeS) },
  ]

  const rows: TargetProgressRow[] = []
  for (const c of comparisons) {
    if (c.targetMs === null) continue
    // Fade can be negative (a negative split); what matters is its size.
    const deltaMs =
      c.actualMs === null
        ? null
        : c.key === 'fade'
          ? Math.abs(c.actualMs) - Math.abs(c.targetMs)
          : c.actualMs - c.targetMs
    rows.push({
      key: c.key,
      label: c.label,
      targetMs: c.targetMs,
      actualMs: c.actualMs,
      deltaMs,
      metGoal: deltaMs !== null && deltaMs <= 0,
    })
  }
  return rows
}
