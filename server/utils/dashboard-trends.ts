import { buildSparkline, type Sparkline } from '../../shared/utils/sparkline'
import { seasonBoundsFromLabel, seasonLabelForDate } from './season'

/**
 * "Ontwikkeling per afstand" on the dashboard, ported from build_home_trend_context
 * in the old app's main.py (checked against golden_dashboard.json).
 *
 * `rows` are the user's races that have a total time (any status, like the old
 * query); only finished ones become points. `trendSeason === undefined` means the
 * parameter was absent from the URL, which defaults to the current season; an
 * explicit empty string means "all seasons".
 */
export interface TrendRaceInput {
  id: number
  distanceM: number
  totalTimeMs: number | null
  status: string
  competitionDate: string
  competitionName: string
}

export interface TrendRow {
  distanceM: number
  count: number
  bestMs: number
  /** Latest minus previous valid time; null with a single point. */
  deltaMs: number | null
  latest: { raceId: number; totalTimeMs: number; date: string }
  sparkline: Sparkline | null
}

export interface HomeTrendContext {
  seasonOptions: string[]
  selectedSeason: string
  trends: TrendRow[]
}

export function buildHomeTrendContext(
  rows: TrendRaceInput[],
  options: { trendSeason?: string; today?: string; invert?: boolean } = {},
): HomeTrendContext {
  const today = options.today ?? new Date().toISOString().slice(0, 10)
  const seasonOptions = [...new Set(rows.filter((r) => r.competitionDate).map((r) => seasonLabelForDate(r.competitionDate)))]
    .sort()
    .reverse()
  const currentSeason = seasonLabelForDate(today)

  let selected = (options.trendSeason ?? '').trim()
  if (options.trendSeason === undefined && !selected && seasonOptions.includes(currentSeason)) selected = currentSeason
  if (selected && !seasonOptions.includes(selected)) selected = seasonOptions.includes(currentSeason) ? currentSeason : ''

  const [filterStart, filterEnd] = selected ? seasonBoundsFromLabel(selected) : [null, null]

  const byDistance = new Map<number, TrendRaceInput[]>()
  for (const row of rows) {
    const list = byDistance.get(row.distanceM) ?? []
    list.push(row)
    byDistance.set(row.distanceM, list)
  }

  const trends: TrendRow[] = []
  for (const distanceM of [...byDistance.keys()].sort((a, b) => a - b)) {
    const valid = byDistance
      .get(distanceM)!
      .filter((r) => r.totalTimeMs !== null && r.status === 'finished')
      .filter((r) => (!filterStart || r.competitionDate >= filterStart) && (!filterEnd || r.competitionDate <= filterEnd))
    if (!valid.length) continue
    const latest = valid[valid.length - 1]!
    const times = valid.map((r) => r.totalTimeMs!)
    trends.push({
      distanceM,
      count: valid.length,
      bestMs: Math.min(...times),
      deltaMs: valid.length > 1 ? latest.totalTimeMs! - valid[valid.length - 2]!.totalTimeMs! : null,
      latest: { raceId: latest.id, totalTimeMs: latest.totalTimeMs!, date: latest.competitionDate },
      sparkline:
        valid.length > 1
          ? buildSparkline(valid, { rangeStart: filterStart, rangeEnd: filterEnd, invert: options.invert })
          : null,
    })
  }

  return { seasonOptions, selectedSeason: selected, trends }
}
