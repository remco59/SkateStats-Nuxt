import { describe, expect, it } from 'vitest'
import { buildStatsContext, type StatsRaceInput } from '../../server/utils/stats'
import { parseLapsToMs } from '../../server/utils/time'
import golden from '../../reference/fixtures/calculations/golden_calculations.json'

const g = golden.stats_engine

function toRow(r: {
  id: number
  competition_id: number
  distance_m: number
  total_time_ms: number
  dnf: number
  competition_date: string
  venue: string
  laps_csv: string | null
}): StatsRaceInput {
  return {
    id: r.id,
    competitionId: r.competition_id,
    distanceM: r.distance_m,
    totalTimeMs: r.dnf === 1 ? null : r.total_time_ms,
    status: r.dnf === 1 ? 'dnf' : 'finished',
    competitionDate: r.competition_date,
    venue: r.venue,
    lapsMs: r.laps_csv ? parseLapsToMs(r.laps_csv).lapsMs : [],
  }
}

describe('stats engine (golden fixture)', () => {
  const rows = g.rows.map(toRow)
  const ctx = buildStatsContext(rows, { season: g.season_filter })

  it('season options and basic stats', () => {
    expect(ctx.seasonOptions).toEqual(g.expected.season_options)
    expect(ctx.basic.raceCount).toBe(g.expected.basic_stats.race_count)
    expect(ctx.basic.competitionCount).toBe(g.expected.basic_stats.competition_count)
    expect(ctx.basic.totalKm).toBeCloseTo(g.expected.basic_stats.total_km, 9)
    expect(ctx.basic.pbCount).toBe(g.expected.basic_stats.pb_count)
    expect(ctx.basic.sbCount).toBe(g.expected.basic_stats.sb_count)
  })

  it('per-distance rows (PB/SB/avg/median/consistency/progression)', () => {
    for (const expectedRow of g.expected.average_rows) {
      const row = ctx.distanceRows.find((r) => r.distanceM === expectedRow.distance_m)!
      expect(row.pbMs).toBe(expectedRow.pb_ms)
      expect(row.pbRaceId).toBe(expectedRow.pb_race_id)
      expect(row.seasonBestMs).toBe(expectedRow.season_best_ms)
      expect(row.seasonBestRaceId).toBe(expectedRow.season_best_race_id)
      expect(row.averageMs).toBe(expectedRow.average_ms)
      expect(row.medianMs).toBe(expectedRow.median_ms)
    }
    for (const expectedRow of g.expected.consistency_rows) {
      const row = ctx.distanceRows.find((r) => r.distanceM === expectedRow.distance_m)!
      expect(row.stdDevMs).toBe(expectedRow.std_dev_ms)
      expect(row.rangeMs).toBe(expectedRow.range_ms)
    }
    for (const expectedRow of g.expected.progress_rows) {
      const row = ctx.distanceRows.find((r) => r.distanceM === expectedRow.distance_m)!
      expect(row.firstMs).toBe(expectedRow.first_ms)
      expect(row.firstRaceId).toBe(expectedRow.first_race_id)
      expect(row.latestMs).toBe(expectedRow.latest_ms)
      expect(row.latestRaceId).toBe(expectedRow.latest_race_id)
      expect(row.improvementMs).toBe(expectedRow.improvement_ms)
      expect(row.last5AvgMs).toBe(expectedRow.last5_avg_ms)
      expect(row.seasonAvgMs).toBe(expectedRow.season_avg_ms)
      expect(row.trend).toBe(expectedRow.trend)
    }
  })

  it('track/venue rows with 500m-equivalent normalization', () => {
    for (const expected of g.expected.track_rows) {
      const row = ctx.trackRows.find((r) => r.venue === expected.track)!
      expect(row.raceCount).toBe(expected.race_count)
      expect(row.avg500EqMs).toBe(expected.avg_500eq_ms)
      expect(row.best500EqMs).toBe(expected.best_500eq_ms)
    }
    expect(ctx.bestTrack).toEqual({ name: g.expected.best_track_summary.name, deltaMs: g.expected.best_track_summary.delta_ms })
    expect(ctx.worstTrack).toEqual({ name: g.expected.worst_track_summary.name, deltaMs: g.expected.worst_track_summary.delta_ms })
  })
})
