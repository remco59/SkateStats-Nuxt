import { describe, expect, it } from 'vitest'
import { buildStatsContext, type StatsRaceInput } from '../../server/utils/stats'
import { formatMonthLabelNl } from '../../server/utils/stats-extras'
import { parseLapsToMs } from '../../server/utils/time'
import golden from '../../reference/fixtures/calculations/golden_stats_extras.json'

interface OldRow {
  id: number
  competition_id: number
  distance_m: number
  total_time_ms: number | null
  dnf: number
  competition_date: string
  venue: string
  laps_csv: string | null
}

const toRow = (r: OldRow): StatsRaceInput => ({
  id: r.id,
  competitionId: r.competition_id,
  distanceM: r.distance_m,
  totalTimeMs: r.dnf === 1 ? null : r.total_time_ms,
  status: r.dnf === 1 ? 'dnf' : 'finished',
  competitionDate: r.competition_date,
  venue: r.venue,
  lapsMs: r.laps_csv ? parseLapsToMs(r.laps_csv).lapsMs : [],
})

const near = (actual: number | null, expected: number | null) =>
  expected === null ? expect(actual).toBeNull() : expect(actual).toBeCloseTo(expected, 9)

// Old story parts carry `href: "/races/<id>"`; the port carries `raceId`.
const normalizeStory = (variants: { title: string; variant: string; paragraphs: { text: string; tone: string; href?: string }[][] }[]) =>
  variants.map((v) => ({
    title: v.title,
    variant: v.variant,
    paragraphs: v.paragraphs.map((p) =>
      p.map((part) => ({
        text: part.text,
        tone: part.tone,
        ...(part.href ? { raceId: Number(part.href.replace('/races/', '')) } : {}),
      })),
    ),
  }))

describe('stats extras (golden fixture: the old app\'s own build_stats_context)', () => {
  for (const c of golden.cases) {
    describe(c.name, () => {
      const ctx = buildStatsContext(c.rows.map(toRow), {
        season: c.params.season,
        distanceM: c.params.distance_m ? Number(c.params.distance_m) : null,
        defaultToCurrent: c.params.default_to_current,
        today: c.today,
      })
      const e = c.expected

      it('picks the same season / distance and SB reference season', () => {
        expect(ctx.seasonOptions).toEqual(e.season_options)
        expect(ctx.selectedSeason).toBe(e.selected_season)
        expect(ctx.selectedDistanceM).toBe(e.selected_distance ? Number(e.selected_distance) : null)
        expect(ctx.distanceOptions).toEqual(e.distance_options)
        expect(ctx.sbReferenceSeason).toBe(e.sb_reference_season)
      })

      it('has the same basic stats', () => {
        expect(ctx.basic.competitionCount).toBe(e.basic_stats.competition_count)
        expect(ctx.basic.raceCount).toBe(e.basic_stats.race_count)
        expect(ctx.basic.totalKm).toBeCloseTo(e.basic_stats.total_km, 9)
        expect(ctx.basic.pbCount).toBe(e.basic_stats.pb_count)
        expect(ctx.basic.sbCount).toBe(e.basic_stats.sb_count)
      })

      it('has the same per-distance rows, including the lap stats', () => {
        expect(ctx.distanceRows.map((r) => r.distanceM)).toEqual(e.distance_overview_rows.map((r) => r.distance_m))
        for (const exp of e.distance_overview_rows) {
          const row = ctx.distanceRows.find((r) => r.distanceM === exp.distance_m)!
          const label = `${exp.distance_m}m`
          expect(row.pbMs, label).toBe(exp.pb_ms)
          expect(row.pbRaceId, label).toBe(exp.pb_race_id)
          expect(row.seasonBestMs, label).toBe(exp.season_best_ms)
          expect(row.seasonBestRaceId, label).toBe(exp.season_best_race_id)
          expect(row.averageMs, label).toBe(exp.average_ms)
          expect(row.medianMs, label).toBe(exp.median_ms)
          near(row.avgOpeningS, exp.avg_opening_s)
          near(row.bestOpeningS, exp.best_opening_s)
          expect(row.bestOpeningRaceId, label).toBe(exp.best_opening_race_id)
          near(row.avgLapS, exp.avg_lap_s)
          near(row.bestLapS, exp.best_lap_s)
          expect(row.bestLapRaceId, label).toBe(exp.best_lap_race_id)
          near(row.avgFadeS, exp.avg_fade_s)
          expect(row.lapAverages.map((l) => l.lapNo), label).toEqual(exp.lap_averages.map((l) => l.lap_no))
          row.lapAverages.forEach((l, i) => near(l.avgS, exp.lap_averages[i]!.avg_s))
        }
        for (const exp of e.consistency_rows) {
          const row = ctx.distanceRows.find((r) => r.distanceM === exp.distance_m)!
          expect(row.stdDevMs).toBe(exp.std_dev_ms)
          expect(row.rangeMs).toBe(exp.range_ms)
        }
        for (const exp of e.progress_rows) {
          const row = ctx.distanceRows.find((r) => r.distanceM === exp.distance_m)!
          expect([row.firstMs, row.firstRaceId, row.latestMs, row.latestRaceId, row.improvementMs]).toEqual([
            exp.first_ms,
            exp.first_race_id,
            exp.latest_ms,
            exp.latest_race_id,
            exp.improvement_ms,
          ])
          expect([row.last5AvgMs, row.seasonAvgMs, row.trend]).toEqual([exp.last5_avg_ms, exp.season_avg_ms, exp.trend])
        }
      })

      it('has the same track rows, best and worst track', () => {
        expect(ctx.trackRows.map((t) => [t.venue, t.raceCount, t.avg500EqMs, t.best500EqMs])).toEqual(
          e.track_rows.map((t) => [t.track, t.race_count, t.avg_500eq_ms, t.best_500eq_ms]),
        )
        const summary = (s: { name: string; delta_ms: number } | null) => (s ? { name: s.name, deltaMs: s.delta_ms } : null)
        expect(ctx.bestTrack).toEqual(summary(e.best_track_summary))
        expect(ctx.worstTrack).toEqual(summary(e.worst_track_summary))
      })

      it('has the same fun stats', () => {
        const f = e.fun_stats
        const lap = (x: { time_ms: number; distance_m: number; venue: string; race_id: number } | null) =>
          x ? { timeMs: x.time_ms, distanceM: x.distance_m, venue: x.venue, raceId: x.race_id } : null
        expect(ctx.funStats.fastestLap).toEqual(lap(f.fastest_lap))
        expect(ctx.funStats.fastestOpener).toEqual(lap(f.fastest_opener))
        expect(ctx.funStats.closestPbMiss).toEqual(
          f.closest_pb_miss
            ? { deltaMs: f.closest_pb_miss.delta_ms, distanceM: f.closest_pb_miss.distance_m, venue: f.closest_pb_miss.venue, raceId: f.closest_pb_miss.race_id }
            : null,
        )
        expect(ctx.funStats.busiestMonth).toEqual(f.busiest_month)
        expect(ctx.funStats.mostSkatedDistance).toEqual(
          f.most_skated_distance ? { distanceM: f.most_skated_distance.distance_m, count: f.most_skated_distance.count } : null,
        )
      })

      it('tells the same stories, word for word', () => {
        expect(ctx.storyCandidates).toEqual(normalizeStory(c.expected_story_candidates))
      })
    })
  }

  it('formats Dutch month labels', () => {
    expect(formatMonthLabelNl('2024-11')).toBe('november 2024')
    expect(formatMonthLabelNl('2025-03')).toBe('maart 2025')
    expect(formatMonthLabelNl('')).toBe('-')
    expect(formatMonthLabelNl('garbage')).toBe('garbage')
  })
})
